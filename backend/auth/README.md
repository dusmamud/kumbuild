# Kumbuild Auth — backend/auth
**Source of truth is `backend/README.md` §5–§6.** This file is the short
spec for the auth module only. (The 2026-11-09 version saying "customers
have no account" is stale and wrong — customers DO have accounts now.)
## Roles (4) — exactly ONE super_admin
`super_admin` (Dus, owner — exactly one, ever) · `admin` (operations) ·
`customer_service` (read + notes only) · `customer` (own orders/profile/
payments only). One role per user (`users.role`). The session stores NO
role — every request loads id/role/status from `users`, so role changes
and disables apply immediately. Guards (server-side, never UI-only):
`super_admin` can never be demoted/disabled (including by self);
`POST /admin/users` with role `super_admin` → 403; admin creates only
`customer`; customer_service creates nobody; wrong role → 403, disabled
login → 401 (generic message, no account enumeration).
## Endpoints
Auth (8) — Turnstile mandatory on every mutating one, CSRF on every
state-changing cookie endpoint:

| Endpoint | Notes |
|---|---|
| `POST /auth/signup` | §2 fields → 201 `{user}` + cookie. Role forced `customer`. Status `pending` until OTP verified. |
| `POST /auth/login` | `{email, password}` → 200 + cookie. `pending`/`invited` → 401. Errors collapse to "invalid credentials". |
| `POST /auth/logout` | Clear cookie + delete session server-side. |
| `GET /auth/me` | 200 `{user}` (incl. `role`) or 401. |
| `POST /auth/forgot-password` | `{email}` → always 200 generic (never leak existence). |
| `POST /auth/reset-password` | `{token, newPassword}` — kind `reset` only. Invalidates ALL sessions. |
| `POST /auth/accept-invite` | `{token, newPassword}` — kind `invite` only. Sets password → email auto-verified, `invited` → `active`. Single-use, 24h. |
| `POST /auth/change-password` | requireAuth. Invalidates all OTHER sessions (current stays). |

User management (super_admin only, except where noted) — one create
endpoint, role check inside the handler:

| Endpoint | Notes |
|---|---|
| `GET /admin/users?role=&status=&q=&page=` | List, paginated. |
| `POST /admin/users` | Single endpoint. super_admin → `admin`/`customer_service`/`customer`; admin → only `customer` (forced). Staff → invite email (kind `invite`, 24h); customer → OTP mail (status `pending`). §2 fields, none dropped. |
| `GET /admin/users/:id` | One user. |
| `PATCH /admin/users/:id/role` | Immediate effect. Never the only super_admin; never self. |
| `PATCH /admin/users/:id/status` | Disable = delete ALL that user's sessions (instant logout). Never the only super_admin; never self. |
| `POST /admin/users/:id/reset-password` | Force reset: all sessions invalidated + reset mail. |
| `POST /admin/users/:id/resend-invite` | Re-invite; old invite token invalidated. Only `invited` users. |
| `GET /admin/audit-logs` | Actor, target, action, before/after role+status, IP, timestamp. Audit row written BEFORE the change. |

Order notes (customer service "read + notes", `order_notes` table —
`id, order_id, author_user_id, note, created_at`):
`POST /admin/orders/:id/notes` (`{note}` → 201) and
`GET /admin/orders/:id/notes` (latest first) — admin, customer_service,
super_admin only.
## Signup fields (§2 of AUTH_PLAN.md)

`full_name` (required) · `email` (required, unique, citext) · `password`
(policy below) · `phone_no` (required, E.164 India +91) · `whatsapp_no`
(required, E.164 — may equal phone) · `alternative_email` (optional,
valid, ≠ primary, unique if given). Billing address — **customer ONLY**,
separate `billing_addresses` table: `billing_name`, `address_line1`,
`address_line2?`, `city`, `state`, `pincode` (6-digit India), `country`
(default India), `gstin?` (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`).
Staff never get a billing address. Validation is server-side; phone OTP
is out of scope — verification is email OTP only.
## Passwords, sessions, tokens

* **Policy** (one validator, all four password endpoints): min 8 chars,
  ≥1 upper + ≥1 lower + ≥1 digit + ≥1 special. HIBP breach check on
  signup/change (fail open if HIBP is down — policy still applies).
* **Hashing:** Argon2id only (`golang.org/x/crypto/argon2`), **19–32MB/
  hash, t=2, p=1** (OWASP min 19 MiB), max 2 concurrent hashes (1GB box).
  Never plaintext / SHA / MD5.
* **Sessions (no JWT):** 32+ random-byte cookie token, only its SHA-256
  stored in Postgres; regenerated at login. **7d absolute expiry + 24h
  idle timeout** (`last_seen_at` refreshed per request; absolute never
  extends). Cookie: HttpOnly + Secure; **prod** `SameSite=Lax` +
  `Domain=.kumbuild.com`; **dev** `SameSite=None` + Secure, no Domain.
* **OTP / tokens** (`auth_tokens`, kind always checked — invite ≠ reset):
  OTP 6-digit, hashed, single-use, 10 min, 5 attempts (counter in Redis);
  reset token 32-byte, hashed, 30 min; invite token 32-byte, hashed, 24h.
  Verification: signup = OTP; invite = auto-verified on password set;
  staff = invite only, no self-signup.
## Turnstile, CSRF, Redis rate limiting

* **Turnstile:** mandatory on signup, login, forgot/reset-password,
  accept-invite. Backend verifies via `POST
  challenges.cloudflare.com/turnstile/v0/siteverify` (secret from env);
  token 300s, single-use; **fail closed** on any failure. Never trust the
  client widget.
* **CSRF:** double-submit token — server sets a `csrf_token` cookie
  (per-session, NOT HttpOnly so JS can read it); frontend sends the same
  value in `X-CSRF-Token` on every POST/PATCH/PUT/DELETE; mismatch → 403.
  Plus Origin/Referer check against allowed origins. GETs exempt.
* **Redis** (same VPS, `localhost` only, 64MB, `allkeys-lru`): login/
  signup rate limits (5/min per-IP + per-account), OTP attempt counters,
  Turnstile throttling. **Redis down → fail safe:** login/signup/forgot/
  reset/accept-invite return **503 + log** (no silent bypass). GETs keep
  working. Sessions are NOT in Redis — Postgres only.
## Email — Brevo (300/day, free, no card)

Official Go SDK `getbrevo/brevo-go` (`SendTransacEmail`, REST). Two
identities: transactional (OTP/invite/reset/order) vs promotional (only
opted-in users, with unsubscribe). Transactional mail goes through a
DB-backed outbox (attempts + status logged, retried); an OTP is never
silently dropped — on limit, a clear 500 "email limit reached". API key
only in env/GitHub Secrets. **Resend OUT — do not use.**
## Seed CLI (exactly one super_admin)

`go run ./cmd/seed-admin --email <dus-email> --phone +919876543210
[--name "Dus Mamud"] [--whatsapp +919876543210]` — password is prompted
twice, hidden, never from env/log. Aborts if a super_admin already
exists. Creates role `super_admin`, status `active`, email verified, no
billing address. After seeding, all accounts come from `POST /admin/users`.
## Env vars

See `backend/.env.example` (copy to `.env`, never commit real values).
Deploy: `.github/workflows/deploy-backend.yml` (skeleton) + systemd
units in `backend/deploy/`.
## Tables

`users` · `billing_addresses` (customer only) · `sessions` ·
`auth_tokens` (otp/reset/invite) · `audit_logs` (before/after in
`details` jsonb) · `order_notes` · `email_outbox`. Full DDL:
`backend/migrations/0001_auth_schema.sql`.
