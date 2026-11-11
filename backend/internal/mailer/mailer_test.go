package mailer

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/dusmamud/kumbuild/backend/internal/testutil"
)

func TestTemplates(t *testing.T) {
	if html := OTPEmailHTML("482913"); !strings.Contains(html, "482913") || !strings.Contains(html, "10 minute") {
		t.Fatalf("OTP template must contain the code + expiry: %s", html)
	}
	if html := InviteEmailHTML("https://x/accept?token=abc", "Dus"); !strings.Contains(html, "abc") || !strings.Contains(html, "Dus") || !strings.Contains(html, "24 ghante") {
		t.Fatalf("invite template wrong: %s", html)
	}
	if html := ResetEmailHTML("https://x/reset?token=abc", "Dus"); !strings.Contains(html, "abc") || !strings.Contains(html, "30 minute") {
		t.Fatalf("reset template wrong: %s", html)
	}
}

func TestSendPromotionalRequiresOptIn(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	cfg := &config.Config{BrevoAPIKey: "fake", TxFromEmail: "tx@x.com", PromoFromEmail: "promo@x.com"}
	m := NewBrevoMailer(cfg, store.NewPGOutboxStore(pool))
	err := m.SendPromotional(context.Background(), "u@example.com", "Dus", "Offer", "<p>hi</p>", "", false)
	if err == nil {
		t.Fatal("promotional mail without opt-in must fail")
	}
	// Nothing must be enqueued for a refused promotional mail.
	due, _ := store.NewPGOutboxStore(pool).ListDue(context.Background(), 10)
	if len(due) != 0 {
		t.Fatalf("refused promotional mail must not be enqueued: %d rows", len(due))
	}
}

// TestSendTransactionalFailureMarksFailed exercises the real outbox flow
// against the test DB with a fake Brevo key: the Brevo call must fail
// (bad key / unreachable), the row must be marked failed with last_error,
// attempts must be 1, and the caller must get the error — never fake success.
func TestSendTransactionalFailureMarksFailed(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	outbox := store.NewPGOutboxStore(pool)
	cfg := &config.Config{BrevoAPIKey: "fake-key-that-brevo-will-reject", TxFromEmail: "tx@kumbuild.com", TxFromName: "Kumbuild"}
	m := NewBrevoMailer(cfg, outbox)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	err := m.SendTransactional(ctx, "u@example.com", "Dus", "OTP 123456", OTPEmailHTML("123456"), "123456")
	if err == nil {
		t.Fatal("send with a fake Brevo key must return an error, not fake success")
	}
	// Fresh context: the send ctx is expired by now (Brevo hung until timeout).
	due, err2 := outbox.ListDue(context.Background(), 10)
	if err2 != nil || len(due) != 1 {
		t.Fatalf("failed mail must stay due for retry: len=%d err=%v", len(due), err2)
	}
	row := due[0]
	if row.Status != store.OutboxStatusFailed || row.Attempts != 1 {
		t.Fatalf("failed row: status=%s attempts=%d", row.Status, row.Attempts)
	}
	if row.LastError == nil || *row.LastError == "" {
		t.Fatal("failed row must record last_error")
	}
	if row.ToEmail != "u@example.com" || row.Subject != "OTP 123456" {
		t.Fatalf("outbox row fields wrong: %+v", row)
	}
}

// fakeRetryMailer records RetryOutbox calls and marks rows sent — lets the
// reaper be tested without touching Brevo.
type fakeRetryMailer struct {
	outbox store.OutboxStore
	calls  int
}

func (f *fakeRetryMailer) SendTransactional(ctx context.Context, to, name, subject, html, text string) error {
	return nil
}
func (f *fakeRetryMailer) SendPromotional(ctx context.Context, to, name, subject, html, text string, optedIn bool) error {
	return nil
}
func (f *fakeRetryMailer) RetryOutbox(ctx context.Context, row *store.OutboxMail) error {
	f.calls++
	return f.outbox.MarkSent(ctx, row.ID)
}

func TestReaperRetriesDueRows(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	outbox := store.NewPGOutboxStore(pool)
	_ = outbox.Enqueue(ctx, &store.OutboxMail{Kind: store.OutboxKindTransactional,
		ToEmail: "r@example.com", Subject: "OTP", HTMLContent: "<p>1</p>"})
	// A promotional row must NOT be retried by the reaper.
	_ = outbox.Enqueue(ctx, &store.OutboxMail{Kind: store.OutboxKindPromotional,
		ToEmail: "p@example.com", Subject: "Offer", HTMLContent: "<p>2</p>"})

	fake := &fakeRetryMailer{outbox: outbox}
	StartReaper(ctx, outbox, fake, 100*time.Millisecond)

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if fake.calls >= 1 {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if fake.calls != 1 {
		t.Fatalf("reaper must retry exactly the transactional row: calls=%d", fake.calls)
	}
	due, _ := outbox.ListDue(ctx, 10)
	if len(due) != 1 || due[0].Kind != store.OutboxKindPromotional {
		t.Fatalf("after reaper, only the promotional row must remain due: %d", len(due))
	}
	cancel()
}
