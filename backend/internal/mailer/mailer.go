// Package mailer sends email through Brevo (official getbrevo/brevo-go
// SDK) via a DB-backed outbox. An OTP is NEVER silently dropped: a failed
// send stays in the outbox as 'failed' with last_error, is retried by the
// reaper, and the caller gets the error (never a fake success).
package mailer

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	brevo "github.com/getbrevo/brevo-go/lib"
)

// Mailer is the interface handlers use to send mail.
type Mailer interface {
	// SendTransactional enqueues the mail, attempts the Brevo send
	// immediately, and returns an error on ANY failure.
	SendTransactional(ctx context.Context, to, name, subject, html, text string) error
	// SendPromotional only sends to opted-in users; !optedIn is an error.
	SendPromotional(ctx context.Context, to, name, subject, html, text string, optedIn bool) error
}

// BrevoMailer implements Mailer with the official Brevo Go SDK.
type BrevoMailer struct {
	client    *brevo.APIClient
	txFrom    brevo.SendSmtpEmailSender
	promoFrom brevo.SendSmtpEmailSender
	outbox    store.OutboxStore
}

// NewBrevoMailer builds a BrevoMailer from config. outbox may be nil only
// in tests that stub sending; production always passes a real store.
func NewBrevoMailer(cfg *config.Config, outbox store.OutboxStore) *BrevoMailer {
	bcfg := brevo.NewConfiguration()
	bcfg.AddDefaultHeader("api-key", cfg.BrevoAPIKey)
	if cfg.MailerAPIBaseURL != "" {
		// Testing override only: production keeps the Brevo default.
		bcfg.BasePath = cfg.MailerAPIBaseURL
	}
	return &BrevoMailer{
		client:    brevo.NewAPIClient(bcfg),
		txFrom:    brevo.SendSmtpEmailSender{Name: cfg.TxFromName, Email: cfg.TxFromEmail},
		promoFrom: brevo.SendSmtpEmailSender{Name: cfg.PromoFromName, Email: cfg.PromoFromEmail},
		outbox:    outbox,
	}
}

func (m *BrevoMailer) SendTransactional(ctx context.Context, to, name, subject, html, text string) error {
	return m.send(ctx, store.OutboxKindTransactional, m.txFrom, to, name, subject, html, text)
}

func (m *BrevoMailer) SendPromotional(ctx context.Context, to, name, subject, html, text string, optedIn bool) error {
	if !optedIn {
		return fmt.Errorf("promotional mail refused: %s has not opted in", to)
	}
	return m.send(ctx, store.OutboxKindPromotional, m.promoFrom, to, name, subject, html, text)
}

// send enqueues the row, attempts the Brevo send immediately, and marks the
// row sent/failed. ANY failure marks failed (with last_error) and returns
// the error — never a fake success.
func (m *BrevoMailer) send(ctx context.Context, kind string, from brevo.SendSmtpEmailSender, to, name, subject, html, text string) error {
	row := &store.OutboxMail{
		Kind:        kind,
		ToEmail:     to,
		ToName:      strPtr(name),
		Subject:     subject,
		HTMLContent: html,
		TextContent: strPtr(text),
	}
	if m.outbox != nil {
		if err := m.outbox.Enqueue(ctx, row); err != nil {
			slog.Error("mailer: outbox enqueue failed", "to", to, "error", err)
			return fmt.Errorf("enqueue mail: %w", err)
		}
	}
	slog.Info("mailer: sending", "kind", kind, "to", to, "subject", subject)
	if err := m.sendViaBrevo(ctx, from, to, name, subject, html, text); err != nil {
		slog.Error("mailer: send failed", "kind", kind, "to", to, "error", err)
		if m.outbox != nil {
			// WithoutCancel: the caller's ctx may already be expired
			// (timeout/cancelled request) — the outbox status update must
			// still land, or the failed mail would silently look pending.
			_ = m.outbox.MarkFailed(context.WithoutCancel(ctx), row.ID, err.Error())
		}
		return err
	}
	slog.Info("mailer: sent", "kind", kind, "to", to)
	if m.outbox != nil {
		_ = m.outbox.MarkSent(context.WithoutCancel(ctx), row.ID)
	}
	return nil
}

func (m *BrevoMailer) sendViaBrevo(ctx context.Context, from brevo.SendSmtpEmailSender, to, name, subject, html, text string) error {
	email := brevo.SendSmtpEmail{
		Sender:      &from,
		To:          []brevo.SendSmtpEmailTo{{Email: to, Name: name}},
		Subject:     subject,
		HtmlContent: html,
		TextContent: text,
	}
	_, resp, err := m.client.TransactionalEmailsApi.SendTransacEmail(ctx, email)
	if err != nil {
		return fmt.Errorf("brevo send: %w", err)
	}
	if resp != nil && resp.StatusCode >= 400 {
		return fmt.Errorf("brevo send: HTTP %d", resp.StatusCode)
	}
	return nil
}

// RetryOutbox sends an existing outbox row via Brevo (transactional
// sender) and marks THAT row sent/failed — it does NOT enqueue a new row,
// so a retry never duplicates the mail.
func (m *BrevoMailer) RetryOutbox(ctx context.Context, row *store.OutboxMail) error {
	if err := m.sendViaBrevo(ctx, m.txFrom, row.ToEmail, deref(row.ToName), row.Subject, row.HTMLContent, deref(row.TextContent)); err != nil {
		slog.Error("mailer: retry send failed", "id", row.ID, "to", row.ToEmail, "error", err)
		if m.outbox != nil {
			// Status update must survive a cancelled/expired ctx.
			_ = m.outbox.MarkFailed(context.WithoutCancel(ctx), row.ID, err.Error())
		}
		return err
	}
	slog.Info("mailer: retry sent", "id", row.ID, "to", row.ToEmail)
	if m.outbox != nil {
		_ = m.outbox.MarkSent(context.WithoutCancel(ctx), row.ID)
	}
	return nil
}

// StartReaper retries due outbox rows every interval, up to 5 attempts per
// row (ListDue enforces the budget). It stops when ctx is cancelled.
// Each outcome is logged. The mailer must implement RetryOutbox; a mailer
// that cannot retry an existing row is logged and skipped — retries must
// never enqueue duplicate rows.
func StartReaper(ctx context.Context, outbox store.OutboxStore, mailer Mailer, interval time.Duration) {
	type retryer interface {
		RetryOutbox(context.Context, *store.OutboxMail) error
	}
	r, ok := mailer.(retryer)
	if !ok {
		slog.Error("mailer reaper: mailer cannot retry outbox rows, reaper disabled")
		return
	}
	go func() {
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				due, err := outbox.ListDue(ctx, 50)
				if err != nil {
					slog.Error("mailer reaper: list due failed", "error", err)
					continue
				}
				for _, row := range due {
					// Reaper only retries transactional mail: promotional
					// sends need a live opt-in check, which the reaper
					// cannot re-verify from the outbox row.
					if row.Kind == store.OutboxKindPromotional {
						continue
					}
					if err := r.RetryOutbox(ctx, row); err != nil {
						slog.Warn("mailer reaper: retry failed", "id", row.ID, "to", row.ToEmail, "error", err)
					}
				}
			}
		}
	}()
}

// ReaperInterval is the default retry sweep interval (60s).
const ReaperInterval = 60 * time.Second

// ---------------------------------------------------------------- templates

// OTPEmailHTML renders the email-verification OTP mail.
func OTPEmailHTML(code string) string {
	return fmt.Sprintf(`<!DOCTYPE html><html><body style="font-family:sans-serif">
<p>Namaste,</p>
<p>Aapka Kumbuild verification code hai:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">%s</p>
<p>Ye code 10 minute ke liye valid hai. Kisi se share na karein.</p>
<p>— Team Kumbuild</p>
</body></html>`, code)
}

// InviteEmailHTML renders the staff invite mail.
func InviteEmailHTML(link, name string) string {
	return fmt.Sprintf(`<!DOCTYPE html><html><body style="font-family:sans-serif">
<p>Namaste %s,</p>
<p>Aapko Kumbuild team me invite kiya gaya hai. Apna password set karne ke liye neeche diye gaye link par click karein:</p>
<p><a href="%s">Set your password</a></p>
<p>Ye link 24 ghante ke liye valid hai.</p>
<p>— Team Kumbuild</p>
</body></html>`, name, link)
}

// ResetEmailHTML renders the password-reset mail.
func ResetEmailHTML(link, name string) string {
	return fmt.Sprintf(`<!DOCTYPE html><html><body style="font-family:sans-serif">
<p>Namaste %s,</p>
<p>Aapne Kumbuild account ka password reset karne ka request kiya tha. Neeche diye gaye link par click karein:</p>
<p><a href="%s">Reset your password</a></p>
<p>Ye link 30 minute ke liye valid hai. Agar aapne ye request nahi kiya tha, to is email ko ignore karein.</p>
<p>— Team Kumbuild</p>
</body></html>`, name, link)
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
