// Package store holds the data models, store interfaces and their pgx
// implementations. SQL lives here (no ORM). Password hashes are never
// serialized to JSON.
package store

import (
	"net/netip"
	"time"
)

// Roles — exactly ONE super_admin ever exists (AUTH_PLAN.md §1).
const (
	RoleSuperAdmin      = "super_admin"
	RoleAdmin           = "admin"
	RoleCustomerService = "customer_service"
	RoleCustomer        = "customer"
)

// User statuses.
const (
	StatusActive   = "active"
	StatusDisabled = "disabled"
	StatusPending  = "pending" // signed up, OTP not verified yet
	StatusInvited  = "invited" // staff invited, password not set yet
)

// Auth token kinds.
const (
	TokenKindOTP    = "otp"
	TokenKindReset  = "reset"
	TokenKindInvite = "invite"
)

// Outbox kinds / statuses.
const (
	OutboxKindTransactional = "transactional"
	OutboxKindPromotional   = "promotional"
	OutboxStatusPending     = "pending"
	OutboxStatusSent        = "sent"
	OutboxStatusFailed      = "failed"
)

// User is one account. PasswordHash is never serialized (json:"-").
type User struct {
	ID               string     `json:"id"`
	FullName         string     `json:"full_name"`
	Email            string     `json:"email"`
	PasswordHash     string     `json:"-"`
	PhoneNo          string     `json:"phone_no"`
	WhatsAppNo       string     `json:"whatsapp_no"`
	AlternativeEmail *string    `json:"alternative_email,omitempty"`
	Role             string     `json:"role"`
	Status           string     `json:"status"`
	EmailVerifiedAt  *time.Time `json:"email_verified_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// BillingAddress is the customer-only billing address (separate table).
type BillingAddress struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	BillingName  string    `json:"billing_name"`
	AddressLine1 string    `json:"address_line1"`
	AddressLine2 *string   `json:"address_line2,omitempty"`
	City         string    `json:"city"`
	State        string    `json:"state"`
	Pincode      string    `json:"pincode"`
	Country      string    `json:"country"`
	GSTIN        *string   `json:"gstin,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Session is one logged-in browser session. Only the SHA-256 hash of the
// cookie token is stored — never the token itself.
type Session struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	TokenHash  string     `json:"-"`
	CreatedAt  time.Time  `json:"created_at"`
	ExpiresAt  time.Time  `json:"expires_at"`   // 7 days absolute
	LastSeenAt time.Time  `json:"last_seen_at"` // idle timeout 24h
	IP         netip.Addr `json:"ip,omitempty"`
	UserAgent  *string    `json:"user_agent,omitempty"`
}

// AuthToken is an OTP code, password-reset token or invite token. Only the
// hash is stored; kind is always checked on use.
type AuthToken struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	Kind      string     `json:"kind"`
	TokenHash string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	Attempts  int        `json:"attempts"`
	CreatedAt time.Time  `json:"created_at"`
}

// AuditLog records one admin/user-management action with before/after
// values in Details (e.g. role/status changes).
type AuditLog struct {
	ID           string         `json:"id"`
	ActorUserID  *string        `json:"actor_user_id,omitempty"` // nil = system action
	Action       string         `json:"action"`
	TargetUserID *string        `json:"target_user_id,omitempty"`
	Details      map[string]any `json:"details"`
	IP           netip.Addr     `json:"ip,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
}

// OrderNote is an internal note on an order (customer service "read +
// notes"). OrderID is plain text for now — the orders table does not exist
// yet (Phases 4-6), so there is no FK.
type OrderNote struct {
	ID           string    `json:"id"`
	OrderID      string    `json:"order_id"`
	AuthorUserID string    `json:"author_user_id"`
	Note         string    `json:"note"`
	CreatedAt    time.Time `json:"created_at"`
}

// OutboxMail is one row of the DB-backed email outbox.
type OutboxMail struct {
	ID          string    `json:"id"`
	Kind        string    `json:"kind"`
	ToEmail     string    `json:"to_email"`
	ToName      *string   `json:"to_name,omitempty"`
	Subject     string    `json:"subject"`
	HTMLContent string    `json:"html_content"`
	TextContent *string   `json:"text_content,omitempty"`
	Status      string    `json:"status"`
	Attempts    int       `json:"attempts"`
	LastError   *string   `json:"last_error,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
