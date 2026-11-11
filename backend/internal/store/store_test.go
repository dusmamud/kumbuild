package store

import (
	"context"
	"errors"
	"net/netip"
	"testing"
	"time"

	"github.com/dusmamud/kumbuild/backend/internal/testutil"
)

func strp(s string) *string { return &s }

func newUser(t *testing.T, users *PGUserStore, email string, role, status string) *User {
	t.Helper()
	u := &User{
		FullName: "Dus Mamud", Email: email, PhoneNo: "+919876543210",
		WhatsAppNo: "+919876543210", Role: role, Status: status,
	}
	if err := users.Create(context.Background(), u, "hash-"+email, nil); err != nil {
		t.Fatalf("create user %s: %v", email, err)
	}
	return u
}

func TestUserCreateGet(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := NewPGUserStore(pool)

	alt := "alt@example.com"
	u := &User{
		FullName: "Dus Mamud", Email: "Dus@Example.com", PhoneNo: "+919876543210",
		WhatsAppNo: "+919876543210", AlternativeEmail: &alt,
		Role: RoleCustomer, Status: StatusPending,
	}
	billing := &BillingAddress{
		BillingName: "Dus Mamud", AddressLine1: "1 Main Rd", City: "Mumbai",
		State: "Maharashtra", Pincode: "400001", Country: "India",
	}
	if err := users.Create(ctx, u, "argon2-hash", billing); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if u.ID == "" || billing.ID == "" || billing.UserID != u.ID {
		t.Fatalf("ids not filled: user=%q billing=%q billing.user=%q", u.ID, billing.ID, billing.UserID)
	}
	if u.CreatedAt.IsZero() {
		t.Fatal("created_at not filled")
	}

	// Case-insensitive email lookup (citext).
	got, err := users.GetByEmail(ctx, "dus@example.com")
	if err != nil || got.ID != u.ID {
		t.Fatalf("GetByEmail case-insensitive: %v %v", got, err)
	}
	if got.AlternativeEmail == nil || *got.AlternativeEmail != alt {
		t.Fatalf("alternative_email: %v", got.AlternativeEmail)
	}
	got, err = users.GetByID(ctx, u.ID)
	if err != nil || got.Email != "Dus@Example.com" {
		t.Fatalf("GetByID: %v %v", got, err)
	}

	// Duplicate email must fail (unique constraint).
	dup := &User{FullName: "Other", Email: "DUS@example.com", PhoneNo: "+919876543210",
		WhatsAppNo: "+919876543210", Role: RoleCustomer, Status: StatusPending}
	if err := users.Create(ctx, dup, "hash", nil); err == nil {
		t.Fatal("duplicate email must fail")
	}

	// Missing user -> ErrNotFound.
	if _, err := users.GetByID(ctx, "00000000-0000-0000-0000-000000000000"); !errors.Is(err, errNotFound) {
		t.Fatalf("missing user must return errNotFound, got %v", err)
	}
}

func TestUserCreateEmptyAltEmailIsNull(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := NewPGUserStore(pool)

	empty := ""
	u := &User{FullName: "A", Email: "a@example.com", PhoneNo: "+919876543210",
		WhatsAppNo: "+919876543210", AlternativeEmail: &empty, Role: RoleCustomer, Status: StatusPending}
	if err := users.Create(ctx, u, "h", nil); err != nil {
		t.Fatalf("Create: %v", err)
	}
	got, err := users.GetByID(ctx, u.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.AlternativeEmail != nil {
		t.Fatalf("empty alternative_email must be stored NULL, got %q", *got.AlternativeEmail)
	}
	// A second user may also have NULL alt email (NULLs don't collide).
	u2 := &User{FullName: "B", Email: "b@example.com", PhoneNo: "+919876543210",
		WhatsAppNo: "+919876543210", Role: RoleCustomer, Status: StatusPending}
	if err := users.Create(ctx, u2, "h", nil); err != nil {
		t.Fatalf("second user with NULL alt email: %v", err)
	}
}

func TestUserListAndUpdates(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := NewPGUserStore(pool)

	newUser(t, users, "c1@example.com", RoleCustomer, StatusActive)
	newUser(t, users, "c2@example.com", RoleCustomer, StatusPending)
	newUser(t, users, "a1@example.com", RoleAdmin, StatusActive)
	sa := newUser(t, users, "sa@example.com", RoleSuperAdmin, StatusActive)

	list, total, err := users.List(ctx, "", "", "", 10, 0)
	if err != nil || total != 4 || len(list) != 4 {
		t.Fatalf("list all: total=%d len=%d err=%v", total, len(list), err)
	}
	list, total, err = users.List(ctx, RoleCustomer, "", "", 10, 0)
	if err != nil || total != 2 {
		t.Fatalf("list role=customer: total=%d err=%v", total, err)
	}
	list, total, err = users.List(ctx, "", StatusPending, "", 10, 0)
	if err != nil || total != 1 {
		t.Fatalf("list status=pending: total=%d err=%v", total, err)
	}
	list, total, err = users.List(ctx, "", "", "c1@", 10, 0)
	if err != nil || total != 1 || list[0].Email != "c1@example.com" {
		t.Fatalf("list q=c1@: total=%d err=%v", total, err)
	}
	// Pagination: 1 per page, second page differs from first.
	p1, _, _ := users.List(ctx, "", "", "", 1, 0)
	p2, _, _ := users.List(ctx, "", "", "", 1, 1)
	if len(p1) != 1 || len(p2) != 1 || p1[0].ID == p2[0].ID {
		t.Fatalf("pagination broken: %v / %v", p1, p2)
	}

	if n, err := users.CountSuperAdmins(ctx); err != nil || n != 1 {
		t.Fatalf("CountSuperAdmins: %d %v", n, err)
	}
	if ok, err := users.ExistsByEmail(ctx, "C1@EXAMPLE.COM"); err != nil || !ok {
		t.Fatalf("ExistsByEmail case-insensitive: %v %v", ok, err)
	}
	if ok, _ := users.ExistsByEmail(ctx, "nope@example.com"); ok {
		t.Fatal("ExistsByEmail must be false for unknown email")
	}

	// Updates.
	if err := users.UpdateRole(ctx, sa.ID, RoleAdmin); err != nil {
		t.Fatalf("UpdateRole: %v", err)
	}
	got, _ := users.GetByID(ctx, sa.ID)
	if got.Role != RoleAdmin {
		t.Fatalf("role not updated: %s", got.Role)
	}
	if n, _ := users.CountSuperAdmins(ctx); n != 0 {
		t.Fatalf("CountSuperAdmins after demote: %d", n)
	}
	if err := users.UpdateStatus(ctx, sa.ID, StatusDisabled); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}
	if err := users.UpdatePasswordHash(ctx, sa.ID, "new-hash"); err != nil {
		t.Fatalf("UpdatePasswordHash: %v", err)
	}
	got, _ = users.GetByID(ctx, sa.ID)
	if got.Status != StatusDisabled || got.PasswordHash != "new-hash" {
		t.Fatalf("updates not applied: %+v", got)
	}
	if err := users.UpdateRole(ctx, "00000000-0000-0000-0000-000000000000", RoleAdmin); !errors.Is(err, errNotFound) {
		t.Fatalf("update missing user must be errNotFound: %v", err)
	}
}

func TestSetEmailVerified(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := NewPGUserStore(pool)

	pending := newUser(t, users, "p@example.com", RoleCustomer, StatusPending)
	if err := users.SetEmailVerified(ctx, pending.ID); err != nil {
		t.Fatalf("SetEmailVerified: %v", err)
	}
	got, _ := users.GetByID(ctx, pending.ID)
	if got.Status != StatusActive || got.EmailVerifiedAt == nil {
		t.Fatalf("pending user must become active+verified: %+v", got)
	}

	// Invited user: verified stamp set, status NOT flipped to active
	// (accept-invite owns that transition).
	invited := newUser(t, users, "i@example.com", RoleAdmin, StatusInvited)
	if err := users.SetEmailVerified(ctx, invited.ID); err != nil {
		t.Fatalf("SetEmailVerified invited: %v", err)
	}
	got, _ = users.GetByID(ctx, invited.ID)
	if got.Status != StatusInvited {
		t.Fatalf("invited status must stay invited: %s", got.Status)
	}
}

func TestBillingUpsertGet(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := NewPGUserStore(pool)
	u := newUser(t, users, "b@example.com", RoleCustomer, StatusActive)

	b := &BillingAddress{UserID: u.ID, BillingName: "Dus", AddressLine1: "1 Rd",
		City: "Mumbai", State: "MH", Pincode: "400001", Country: "India"}
	if err := users.Upsert(ctx, b); err != nil {
		t.Fatalf("Upsert: %v", err)
	}
	got, err := users.GetByUserID(ctx, u.ID)
	if err != nil || got.City != "Mumbai" {
		t.Fatalf("GetByUserID: %v %v", got, err)
	}
	// Upsert again replaces the single row (no duplicate).
	b.City = "Pune"
	b.GSTIN = strp("27ABCDE1234F1Z5")
	if err := users.Upsert(ctx, b); err != nil {
		t.Fatalf("second Upsert: %v", err)
	}
	got, _ = users.GetByUserID(ctx, u.ID)
	if got.City != "Pune" || got.GSTIN == nil || *got.GSTIN != "27ABCDE1234F1Z5" {
		t.Fatalf("upsert did not replace: %+v", got)
	}
	if _, err := users.GetByUserID(ctx, "00000000-0000-0000-0000-000000000000"); !errors.Is(err, errNotFound) {
		t.Fatalf("missing billing must be errNotFound: %v", err)
	}
}

func TestSessionStore(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := NewPGUserStore(pool)
	sessions := NewPGSessionStore(pool)
	u := newUser(t, users, "s@example.com", RoleCustomer, StatusActive)

	s := &Session{
		UserID: u.ID, TokenHash: "hash-1",
		ExpiresAt:  time.Now().Add(SessionAbsoluteTTL),
		LastSeenAt: time.Now(),
		IP:         netip.MustParseAddr("1.2.3.4"),
		UserAgent:  strp("test-agent"),
	}
	if err := sessions.Create(ctx, s); err != nil {
		t.Fatalf("Create session: %v", err)
	}
	got, err := sessions.GetByTokenHash(ctx, "hash-1")
	if err != nil || got.UserID != u.ID {
		t.Fatalf("GetByTokenHash: %v %v", got, err)
	}
	if !got.IP.IsValid() || got.IP.String() != "1.2.3.4" {
		t.Fatalf("session IP: %v", got.IP)
	}
	if err := sessions.TouchLastSeen(ctx, s.ID); err != nil {
		t.Fatalf("TouchLastSeen: %v", err)
	}
	if err := sessions.Delete(ctx, s.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := sessions.GetByTokenHash(ctx, "hash-1"); !errors.Is(err, errNotFound) {
		t.Fatalf("deleted session must be gone: %v", err)
	}

	// DeleteAllForUser kills every session of that user only.
	u2 := newUser(t, users, "s2@example.com", RoleCustomer, StatusActive)
	for _, h := range []string{"h-a", "h-b"} {
		_ = sessions.Create(ctx, &Session{UserID: u.ID, TokenHash: h,
			ExpiresAt: time.Now().Add(time.Hour), LastSeenAt: time.Now()})
	}
	_ = sessions.Create(ctx, &Session{UserID: u2.ID, TokenHash: "h-c",
		ExpiresAt: time.Now().Add(time.Hour), LastSeenAt: time.Now()})
	if err := sessions.DeleteAllForUser(ctx, u.ID); err != nil {
		t.Fatalf("DeleteAllForUser: %v", err)
	}
	if _, err := sessions.GetByTokenHash(ctx, "h-a"); !errors.Is(err, errNotFound) {
		t.Fatal("h-a must be deleted")
	}
	if _, err := sessions.GetByTokenHash(ctx, "h-c"); err != nil {
		t.Fatal("other user's session must survive DeleteAllForUser")
	}
}

func TestTokenStore(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := NewPGUserStore(pool)
	tokens := NewPGTokenStore(pool)
	u := newUser(t, users, "t@example.com", RoleCustomer, StatusPending)

	tok := &AuthToken{UserID: u.ID, Kind: TokenKindOTP, TokenHash: "otp-hash",
		ExpiresAt: time.Now().Add(OTPTTL)}
	if err := tokens.Create(ctx, tok); err != nil {
		t.Fatalf("Create token: %v", err)
	}
	got, err := tokens.GetValidByHash(ctx, TokenKindOTP, "otp-hash")
	if err != nil || got.ID != tok.ID {
		t.Fatalf("GetValidByHash: %v %v", got, err)
	}
	// Wrong kind must NOT match (invite token can never reset a password).
	if _, err := tokens.GetValidByHash(ctx, TokenKindReset, "otp-hash"); !errors.Is(err, errNotFound) {
		t.Fatalf("wrong-kind lookup must fail: %v", err)
	}
	// Expired token is not valid.
	expired := &AuthToken{UserID: u.ID, Kind: TokenKindReset, TokenHash: "old-hash",
		ExpiresAt: time.Now().Add(-time.Minute)}
	_ = tokens.Create(ctx, expired)
	if _, err := tokens.GetValidByHash(ctx, TokenKindReset, "old-hash"); !errors.Is(err, errNotFound) {
		t.Fatalf("expired token must be invalid: %v", err)
	}
	// Attempts + mark used.
	if err := tokens.IncrementAttempts(ctx, tok.ID); err != nil {
		t.Fatalf("IncrementAttempts: %v", err)
	}
	got, _ = tokens.GetValidByHash(ctx, TokenKindOTP, "otp-hash")
	if got.Attempts != 1 {
		t.Fatalf("attempts: got %d want 1", got.Attempts)
	}
	if err := tokens.MarkUsed(ctx, tok.ID); err != nil {
		t.Fatalf("MarkUsed: %v", err)
	}
	if _, err := tokens.GetValidByHash(ctx, TokenKindOTP, "otp-hash"); !errors.Is(err, errNotFound) {
		t.Fatalf("used token must be invalid: %v", err)
	}
	if err := tokens.MarkUsed(ctx, tok.ID); !errors.Is(err, errNotFound) {
		t.Fatalf("second MarkUsed must fail: %v", err)
	}

	// InvalidateKindForUser kills unused tokens of that kind only.
	for _, h := range []string{"inv-1", "inv-2"} {
		_ = tokens.Create(ctx, &AuthToken{UserID: u.ID, Kind: TokenKindInvite,
			TokenHash: h, ExpiresAt: time.Now().Add(InviteTTL)})
	}
	_ = tokens.Create(ctx, &AuthToken{UserID: u.ID, Kind: TokenKindOTP,
		TokenHash: "otp-keep", ExpiresAt: time.Now().Add(OTPTTL)})
	if err := tokens.InvalidateKindForUser(ctx, u.ID, TokenKindInvite); err != nil {
		t.Fatalf("InvalidateKindForUser: %v", err)
	}
	if _, err := tokens.GetValidByHash(ctx, TokenKindInvite, "inv-1"); !errors.Is(err, errNotFound) {
		t.Fatal("invite tokens must be invalidated")
	}
	if _, err := tokens.GetValidByHash(ctx, TokenKindOTP, "otp-keep"); err != nil {
		t.Fatal("OTP token must survive invite invalidation")
	}
}

func TestAuditStore(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := NewPGUserStore(pool)
	audit := NewPGAuditStore(pool)
	actor := newUser(t, users, "actor@example.com", RoleSuperAdmin, StatusActive)
	target := newUser(t, users, "target@example.com", RoleCustomer, StatusActive)

	// Standalone insert.
	l := &AuditLog{
		ActorUserID: &actor.ID, Action: "user.role.change", TargetUserID: &target.ID,
		Details: map[string]any{"before": map[string]any{"role": "customer"}, "after": map[string]any{"role": "admin"}},
		IP:      netip.MustParseAddr("9.9.9.9"),
	}
	if err := audit.Insert(ctx, nil, l); err != nil {
		t.Fatalf("Insert standalone: %v", err)
	}
	if l.ID == "" {
		t.Fatal("audit id not filled")
	}
	// Insert inside a caller tx (audit-first pattern).
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	l2 := &AuditLog{ActorUserID: &actor.ID, Action: "user.status.change",
		TargetUserID: &target.ID, Details: map[string]any{"before": "active", "after": "disabled"}}
	if err := audit.Insert(ctx, tx, l2); err != nil {
		_ = tx.Rollback(ctx)
		t.Fatalf("Insert in tx: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}

	logs, total, err := audit.List(ctx, "", "", "", 10, 0)
	if err != nil || total != 2 || len(logs) != 2 {
		t.Fatalf("List: total=%d len=%d err=%v", total, len(logs), err)
	}
	if logs[0].Details["after"] != "disabled" {
		t.Fatalf("details not round-tripped: %v", logs[0].Details)
	}
	if !logs[0].IP.IsValid() && logs[1].IP.String() != "9.9.9.9" {
		t.Fatalf("audit IP not stored: %v / %v", logs[0].IP, logs[1].IP)
	}
	logs, total, err = audit.List(ctx, "", "", "user.status.change", 10, 0)
	if err != nil || total != 1 || len(logs) != 1 || logs[0].Action != "user.status.change" {
		t.Fatalf("List by action: total=%d len=%d err=%v", total, len(logs), err)
	}
	logs, total, err = audit.List(ctx, "", "", "user.nonexistent", 10, 0)
	if err != nil || total != 0 || len(logs) != 0 {
		t.Fatalf("List unknown action: total=%d err=%v", total, err)
	}
	logs, total, err = audit.List(ctx, actor.ID, "", "", 10, 0)
	if err != nil || total != 2 {
		t.Fatalf("List by actor: total=%d err=%v", total, err)
	}
	logs, total, err = audit.List(ctx, "00000000-0000-0000-0000-000000000000", "", "", 10, 0)
	if err != nil || total != 0 || len(logs) != 0 {
		t.Fatalf("List unknown actor: total=%d err=%v", total, err)
	}
}

func TestNoteStore(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	users := NewPGUserStore(pool)
	notes := NewPGNoteStore(pool)
	u := newUser(t, users, "n@example.com", RoleCustomerService, StatusActive)

	for _, text := range []string{"first note", "second note"} {
		if err := notes.Create(ctx, &OrderNote{OrderID: "ORD-1001", AuthorUserID: u.ID, Note: text}); err != nil {
			t.Fatalf("Create note: %v", err)
		}
	}
	_ = notes.Create(ctx, &OrderNote{OrderID: "ORD-1002", AuthorUserID: u.ID, Note: "other order"})
	got, err := notes.ListByOrder(ctx, "ORD-1001", 10, 0)
	if err != nil || len(got) != 2 {
		t.Fatalf("ListByOrder: len=%d err=%v", len(got), err)
	}
	if got[0].Note != "second note" {
		t.Fatalf("notes must be newest-first: %q", got[0].Note)
	}
	got, err = notes.ListByOrder(ctx, "ORD-9999", 10, 0)
	if err != nil || len(got) != 0 {
		t.Fatalf("unknown order notes: len=%d err=%v", len(got), err)
	}
}

func TestOutboxStore(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	defer pool.Close()
	ctx := context.Background()
	outbox := NewPGOutboxStore(pool)

	m := &OutboxMail{Kind: OutboxKindTransactional, ToEmail: "u@example.com",
		ToName: strp("Dus"), Subject: "OTP", HTMLContent: "<p>123456</p>"}
	if err := outbox.Enqueue(ctx, m); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	if m.ID == "" || m.Status != OutboxStatusPending {
		t.Fatalf("enqueued row: %+v", m)
	}
	due, err := outbox.ListDue(ctx, 10)
	if err != nil || len(due) != 1 {
		t.Fatalf("ListDue pending: len=%d err=%v", len(due), err)
	}
	if err := outbox.MarkFailed(ctx, m.ID, "smtp boom"); err != nil {
		t.Fatalf("MarkFailed: %v", err)
	}
	due, err = outbox.ListDue(ctx, 10)
	if err != nil || len(due) != 1 {
		t.Fatalf("failed row with attempts<5 must stay due: len=%d err=%v", len(due), err)
	}
	if due[0].LastError == nil || *due[0].LastError != "smtp boom" || due[0].Attempts != 1 {
		t.Fatalf("failed row fields: %+v", due[0])
	}
	// After 5 failures the row drops out of ListDue (retry budget spent).
	for i := 0; i < 4; i++ {
		_ = outbox.MarkFailed(ctx, m.ID, "again")
	}
	due, err = outbox.ListDue(ctx, 10)
	if err != nil || len(due) != 0 {
		t.Fatalf("row with 5 attempts must NOT be due: len=%d err=%v", len(due), err)
	}
	// MarkSent path.
	m2 := &OutboxMail{Kind: OutboxKindPromotional, ToEmail: "p@example.com",
		Subject: "Offer", HTMLContent: "<p>hi</p>"}
	_ = outbox.Enqueue(ctx, m2)
	if err := outbox.MarkSent(ctx, m2.ID); err != nil {
		t.Fatalf("MarkSent: %v", err)
	}
	due, _ = outbox.ListDue(ctx, 10)
	if len(due) != 0 {
		t.Fatalf("sent row must not be due: %d", len(due))
	}
}
