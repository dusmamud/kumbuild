package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/dusmamud/kumbuild/backend/internal/auth"
	"github.com/dusmamud/kumbuild/backend/internal/middleware"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// userFieldsRequest is the §2 field set collected at signup and at admin
// user-create. Role is forced by the server (never trusted from a signup
// body); turnstile_token only applies to signup.
type userFieldsRequest struct {
	FullName         string `json:"full_name"`
	Email            string `json:"email"`
	Password         string `json:"password"`
	PhoneNo          string `json:"phone_no"`
	WhatsAppNo       string `json:"whatsapp_no"`
	AlternativeEmail string `json:"alternative_email"`
	BillingName      string `json:"billing_name"`
	AddressLine1     string `json:"address_line1"`
	AddressLine2     string `json:"address_line2"`
	City             string `json:"city"`
	State            string `json:"state"`
	Pincode          string `json:"pincode"`
	Country          string `json:"country"`
	GSTIN            string `json:"gstin"`
	TurnstileToken   string `json:"turnstile_token"`
	Role             string `json:"role"`
}

func (req userFieldsRequest) toSignupInput(hasBilling bool) auth.SignupInput {
	return auth.SignupInput{
		FullName:         req.FullName,
		Email:            req.Email,
		Password:         req.Password,
		PhoneNo:          req.PhoneNo,
		WhatsAppNo:       req.WhatsAppNo,
		AlternativeEmail: req.AlternativeEmail,
		BillingName:      req.BillingName,
		AddressLine1:     req.AddressLine1,
		AddressLine2:     req.AddressLine2,
		City:             req.City,
		State:            req.State,
		Pincode:          req.Pincode,
		Country:          req.Country,
		GSTIN:            req.GSTIN,
		HasBilling:       hasBilling,
	}
}

// toBilling builds the customer billing address (country defaults India).
func (req userFieldsRequest) toBilling() *store.BillingAddress {
	country := strings.TrimSpace(req.Country)
	if country == "" {
		country = "India"
	}
	b := &store.BillingAddress{
		BillingName:  strings.TrimSpace(req.BillingName),
		AddressLine1: strings.TrimSpace(req.AddressLine1),
		City:         strings.TrimSpace(req.City),
		State:        strings.TrimSpace(req.State),
		Pincode:      strings.TrimSpace(req.Pincode),
		Country:      country,
	}
	if s := strings.TrimSpace(req.AddressLine2); s != "" {
		b.AddressLine2 = &s
	}
	if s := strings.TrimSpace(req.GSTIN); s != "" {
		b.GSTIN = &s
	}
	return b
}

// validateStaffInput validates the §2 fields for staff creation (invite):
// the same rules as auth.ValidateSignupInput, except there is no password
// yet (staff sets it via the invite) and no billing address (staff-only).
func validateStaffInput(in auth.SignupInput) map[string]string {
	errs := map[string]string{}
	if !auth.ValidateFullName(in.FullName) {
		errs["full_name"] = auth.CodeInvalidName
	}
	if strings.TrimSpace(in.Email) == "" {
		errs["email"] = auth.CodeRequired
	} else if !auth.ValidateEmail(in.Email) {
		errs["email"] = auth.CodeInvalidEmail
	}
	if strings.TrimSpace(in.PhoneNo) == "" {
		errs["phone_no"] = auth.CodeRequired
	} else if !auth.ValidateIndianPhone(in.PhoneNo) {
		errs["phone_no"] = auth.CodeInvalidPhone
	}
	if strings.TrimSpace(in.WhatsAppNo) == "" {
		errs["whatsapp_no"] = auth.CodeRequired
	} else if !auth.ValidateE164(in.WhatsAppNo) {
		errs["whatsapp_no"] = auth.CodeInvalidWhatsApp
	}
	if alt := strings.TrimSpace(in.AlternativeEmail); alt != "" {
		switch {
		case !auth.ValidateEmail(alt):
			errs["alternative_email"] = auth.CodeInvalidAltEmail
		case strings.EqualFold(alt, strings.TrimSpace(in.Email)):
			errs["alternative_email"] = auth.CodeAltEmailSameAsPrimary
		}
	}
	return errs
}

// loadTargetUser loads the :id user for admin actions: bad UUID or missing
// row both become 404 "not-found" (no enumeration of what exists).
func (h *Handler) loadTargetUser(w http.ResponseWriter, r *http.Request) *store.User {
	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "not-found", "user not found")
		return nil
	}
	u, err := h.Users.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound()) {
			middleware.WriteError(w, http.StatusNotFound, "not-found", "user not found")
			return nil
		}
		writeInternal(w, r, err, "admin: load user failed")
		return nil
	}
	return u
}

// ListUsers lists users (super_admin only), paginated, with role/status/q
// filters.
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	page, limit := pageParams(r)
	q := r.URL.Query()
	users, total, err := h.Users.List(r.Context(), q.Get("role"), q.Get("status"), q.Get("q"), limit, (page-1)*limit)
	if err != nil {
		writeInternal(w, r, err, "admin: list users failed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{
		"users": users, "total": total, "page": page, "pages": totalPages(total, limit),
	})
}

// CreateUser is the single user-creation endpoint. The role check lives
// INSIDE this handler (no RequireRole middleware): super_admin may create
// admin / customer_service / customer (never super_admin); admin may only
// create customers (role forced); customer_service may create nobody.
func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	actor := currentUser(r)
	if actor == nil {
		middleware.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var req userFieldsRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	role := strings.TrimSpace(req.Role)
	switch actor.Role {
	case store.RoleSuperAdmin:
		if role == "" {
			role = store.RoleCustomer
		}
		if role == store.RoleSuperAdmin {
			middleware.WriteError(w, http.StatusForbidden, "cannot-create-super-admin", "a second super_admin cannot be created")
			return
		}
		if role != store.RoleAdmin && role != store.RoleCustomerService && role != store.RoleCustomer {
			writeValidationError(w, map[string]string{"role": "invalid-role"})
			return
		}
	case store.RoleAdmin:
		if role != "" && role != store.RoleCustomer {
			middleware.WriteError(w, http.StatusForbidden, "forbidden", "admins can only create customers")
			return
		}
		role = store.RoleCustomer
	default: // customer_service (a customer never reaches here usefully)
		middleware.WriteError(w, http.StatusForbidden, "forbidden", "insufficient permissions")
		return
	}

	isCustomer := role == store.RoleCustomer
	in := req.toSignupInput(isCustomer)
	var errs map[string]string
	if isCustomer {
		errs = auth.ValidateSignupInput(in)
	} else {
		// Staff: no password yet, no billing address (any billing fields
		// in the body are ignored, not stored).
		errs = validateStaffInput(in)
	}
	if len(errs) > 0 {
		writeValidationError(w, errs)
		return
	}
	exists, err := h.Users.ExistsByEmail(r.Context(), strings.TrimSpace(req.Email))
	if err != nil {
		writeInternal(w, r, err, "create-user: exists check failed")
		return
	}
	if exists {
		middleware.WriteError(w, http.StatusConflict, "exists", "an account with this email already exists")
		return
	}
	var hash string
	if isCustomer {
		if !h.checkNewPassword(w, r, req.Password, "password") {
			return
		}
		hash, err = auth.HashPassword(req.Password)
		if err != nil {
			writeInternal(w, r, err, "create-user: hash failed")
			return
		}
	}
	// Staff have no password until they accept the invite (empty hash;
	// login is impossible while status is invited anyway).
	u := &store.User{
		FullName:   strings.TrimSpace(req.FullName),
		Email:      strings.TrimSpace(req.Email),
		PhoneNo:    strings.TrimSpace(req.PhoneNo),
		WhatsAppNo: strings.TrimSpace(req.WhatsAppNo),
		Role:       role,
		Status:     store.StatusPending,
	}
	if !isCustomer {
		u.Status = store.StatusInvited
	}
	if alt := strings.TrimSpace(req.AlternativeEmail); alt != "" {
		u.AlternativeEmail = &alt
	}
	var billing *store.BillingAddress
	if isCustomer {
		billing = req.toBilling()
	}
	if err := h.Users.Create(r.Context(), u, hash, billing); err != nil {
		if isUniqueViolation(err) {
			middleware.WriteError(w, http.StatusConflict, "exists", "an account with this email already exists")
			return
		}
		writeInternal(w, r, err, "create-user: create failed")
		return
	}
	// Audit AFTER creation: the audit row FK-references the user, which
	// does not exist until this insert returns. before=null (new user).
	if err := h.audit(r.Context(), r, actor.ID, "user.created", u.ID, map[string]any{
		"before": nil,
		"after":  map[string]string{"role": u.Role, "status": u.Status},
	}); err != nil {
		slog.Error("create-user: audit failed", "error", err, "user_id", u.ID)
	}
	if isCustomer {
		code, err := h.createOTP(r.Context(), u.ID)
		if err != nil {
			writeInternal(w, r, err, "create-user: otp create failed")
			return
		}
		if err := h.sendOTPEmail(r.Context(), u, code); err != nil {
			slog.Error("create-user: otp email failed", "error", err, "user_id", u.ID)
			middleware.WriteError(w, http.StatusInternalServerError, "email-failed", "could not send verification email, use resend-otp later")
			return
		}
	} else {
		_, raw, err := h.createToken(r.Context(), u.ID, store.TokenKindInvite, store.InviteTTL)
		if err != nil {
			writeInternal(w, r, err, "create-user: invite token failed")
			return
		}
		if err := h.sendInviteEmail(r.Context(), u, raw); err != nil {
			slog.Error("create-user: invite email failed", "error", err, "user_id", u.ID)
			middleware.WriteError(w, http.StatusInternalServerError, "email-failed", "could not send invite email, use resend-invite later")
			return
		}
	}
	middleware.WriteJSON(w, http.StatusCreated, map[string]any{"user": u})
}

// GetUser returns one user (super_admin only).
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	u := h.loadTargetUser(w, r)
	if u == nil {
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{"user": u})
}

// ChangeUserRole changes a user's role (super_admin only). The only
// super_admin can never be demoted, and nobody can change their own role.
func (h *Handler) ChangeUserRole(w http.ResponseWriter, r *http.Request) {
	actor := currentUser(r)
	if actor == nil {
		middleware.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	target := h.loadTargetUser(w, r)
	if target == nil {
		return
	}
	var req struct {
		Role string `json:"role"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	role := strings.TrimSpace(req.Role)
	switch {
	case role == store.RoleSuperAdmin:
		middleware.WriteError(w, http.StatusForbidden, "forbidden", "role super_admin cannot be assigned")
		return
	case role != store.RoleAdmin && role != store.RoleCustomerService && role != store.RoleCustomer:
		writeValidationError(w, map[string]string{"role": "invalid-role"})
		return
	case target.Role == store.RoleSuperAdmin:
		middleware.WriteError(w, http.StatusForbidden, "cannot-demote-super-admin", "the super_admin cannot be demoted")
		return
	case actor.ID == target.ID:
		middleware.WriteError(w, http.StatusForbidden, "cannot-change-own-role", "you cannot change your own role")
		return
	}
	// Audit BEFORE the change, with before/after role+status.
	details := roleStatusDetails(target.Role, target.Status, role, target.Status)
	if err := h.audit(r.Context(), r, actor.ID, "user.role_changed", target.ID, details); err != nil {
		writeInternal(w, r, err, "change-role: audit failed")
		return
	}
	if err := h.Users.UpdateRole(r.Context(), target.ID, role); err != nil {
		writeInternal(w, r, err, "change-role: update failed")
		return
	}
	u, err := h.Users.GetByID(r.Context(), target.ID)
	if err != nil {
		writeInternal(w, r, err, "change-role: reload failed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{"user": u})
}

// ChangeUserStatus changes a user's status (super_admin only). Only
// active/disabled are allowed here. The only super_admin can never be
// disabled, and nobody can disable themselves. Disabling deletes all of
// the user's sessions (immediate logout).
func (h *Handler) ChangeUserStatus(w http.ResponseWriter, r *http.Request) {
	actor := currentUser(r)
	if actor == nil {
		middleware.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	target := h.loadTargetUser(w, r)
	if target == nil {
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	status := strings.TrimSpace(req.Status)
	switch {
	case status != store.StatusActive && status != store.StatusDisabled:
		writeValidationError(w, map[string]string{"status": "invalid-status"})
		return
	case target.Role == store.RoleSuperAdmin:
		middleware.WriteError(w, http.StatusForbidden, "cannot-change-super-admin", "the super_admin cannot be disabled")
		return
	case actor.ID == target.ID:
		middleware.WriteError(w, http.StatusForbidden, "cannot-change-own-status", "you cannot change your own status")
		return
	}
	// Audit BEFORE the change, with before/after role+status.
	details := roleStatusDetails(target.Role, target.Status, target.Role, status)
	if err := h.audit(r.Context(), r, actor.ID, "user.status_changed", target.ID, details); err != nil {
		writeInternal(w, r, err, "change-status: audit failed")
		return
	}
	if err := h.Users.UpdateStatus(r.Context(), target.ID, status); err != nil {
		writeInternal(w, r, err, "change-status: update failed")
		return
	}
	if status == store.StatusDisabled {
		_ = h.Sessions.DeleteAllForUser(r.Context(), target.ID)
	}
	u, err := h.Users.GetByID(r.Context(), target.ID)
	if err != nil {
		writeInternal(w, r, err, "change-status: reload failed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{"user": u})
}

// ResetUserPassword force-resets a user's password (super_admin only):
// all sessions invalidated, old reset tokens invalidated, new reset token
// emailed. Mail failure is logged only — the token exists and the endpoint
// can be retried.
func (h *Handler) ResetUserPassword(w http.ResponseWriter, r *http.Request) {
	actor := currentUser(r)
	if actor == nil {
		middleware.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	target := h.loadTargetUser(w, r)
	if target == nil {
		return
	}
	// Audit BEFORE the change (role/status unchanged by a password reset).
	details := roleStatusDetails(target.Role, target.Status, target.Role, target.Status)
	if err := h.audit(r.Context(), r, actor.ID, "user.password_reset_forced", target.ID, details); err != nil {
		writeInternal(w, r, err, "reset-user-password: audit failed")
		return
	}
	_ = h.Sessions.DeleteAllForUser(r.Context(), target.ID)
	_ = h.Tokens.InvalidateKindForUser(r.Context(), target.ID, store.TokenKindReset)
	_, raw, err := h.createToken(r.Context(), target.ID, store.TokenKindReset, store.ResetTTL)
	if err != nil {
		writeInternal(w, r, err, "reset-user-password: token create failed")
		return
	}
	if err := h.sendResetEmail(r.Context(), target, raw); err != nil {
		slog.Error("reset-user-password: email failed", "error", err, "user_id", target.ID)
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "password reset email sent"})
}

// ResendInvite re-sends the staff invite (super_admin only, invited users
// only). The old invite token is invalidated first.
func (h *Handler) ResendInvite(w http.ResponseWriter, r *http.Request) {
	actor := currentUser(r)
	if actor == nil {
		middleware.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	target := h.loadTargetUser(w, r)
	if target == nil {
		return
	}
	if target.Status != store.StatusInvited {
		middleware.WriteError(w, http.StatusBadRequest, "not-invited", "user has not been invited")
		return
	}
	// Audit BEFORE the change.
	details := roleStatusDetails(target.Role, target.Status, target.Role, target.Status)
	if err := h.audit(r.Context(), r, actor.ID, "user.invite_resent", target.ID, details); err != nil {
		writeInternal(w, r, err, "resend-invite: audit failed")
		return
	}
	if err := h.Tokens.InvalidateKindForUser(r.Context(), target.ID, store.TokenKindInvite); err != nil {
		writeInternal(w, r, err, "resend-invite: invalidate failed")
		return
	}
	_, raw, err := h.createToken(r.Context(), target.ID, store.TokenKindInvite, store.InviteTTL)
	if err != nil {
		writeInternal(w, r, err, "resend-invite: token create failed")
		return
	}
	if err := h.sendInviteEmail(r.Context(), target, raw); err != nil {
		slog.Error("resend-invite: email failed", "error", err, "user_id", target.ID)
		middleware.WriteError(w, http.StatusInternalServerError, "email-failed", "could not send invite email, try again later")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "invite sent"})
}

// ListAuditLogs lists audit rows newest-first (super_admin only), with
// actor/target/action/page filters.
func (h *Handler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	page, limit := pageParams(r)
	q := r.URL.Query()
	actorID, targetID, action := q.Get("actor"), q.Get("target"), q.Get("action")
	for field, v := range map[string]string{"actor": actorID, "target": targetID} {
		if v != "" {
			if _, err := uuid.Parse(v); err != nil {
				writeValidationError(w, map[string]string{field: "invalid-uuid"})
				return
			}
		}
	}
	logs, total, err := h.Audit.List(r.Context(), actorID, targetID, action, limit, (page-1)*limit)
	if err != nil {
		writeInternal(w, r, err, "admin: list audit logs failed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{
		"logs": logs, "total": total, "page": page, "pages": totalPages(total, limit),
	})
}
