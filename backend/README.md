# Kumbuild Backend

Status: **Stack LOCKED (2026-11-11, user approved).** Ye file backend ka source of truth hai — isme jo likha hai wahi banega.
Jo cheez lock nahi hui, uske saamne **TBD** likha hai.

```text
backend/
  auth/         customer + admin login/signup, sessions, roles, password reset
  orders/       order create (admin add karega), status, tracking
  payments/     advance + final payment, renewal (Razorpay)
  chat/         WhatsApp / Instagram DM — in-app chat nahi hoga
  websites/     delivered websites, builds, domains
  shared/       shared types, utils, DB access
```

**Note:** `backend/*/README.md` (auth/orders/chat) 2026-11-09 wale purane plan ke hain — wo kehte hain
"customer ka koi account/dashboard nahi hai" aur in-app chat plan karte hain. Ye sab **stale** hai aur
2026-11-11 ke plan se takrata hai. Unhe dobara likhna baki hai (Phase 0). Tab tak **ye file** hi source
of truth hai.

Pehle frontend mock data se complete hoga. Backend tab banega jab frontend ready ho.

---

## 1. Locked stack

| Layer | Choice | Status |
|---|---|---|
| Language | Go (Golang) — saare zaroori Go packages | LOCKED 2026-11-11 |
| Database | PostgreSQL — Oracle VPS pe hi (same box) | LOCKED 2026-11-11 |
| Hosting | Oracle VPS | LOCKED 2026-11-11 |
| Deploy | GitHub Actions workflow se VPS pe | LOCKED 2026-11-11 |
| Connectivity | Cloudflare Tunnel — VPS se outbound-only; koi inbound port nahi khulta | LOCKED 2026-11-11 |
| API | `api.kumbuild.com` (production) — dev me trycloudflare.com quick tunnel URL (§3.1 dekho) | LOCKED |
| Auth | Custom Go auth (session cookie, neeche §6 dekho) + 4 roles (super_admin/admin/customer_service/customer) | LOCKED 2026-11-11 |
| Email | Brevo (free tier — 300/day; Resend OUT) | LOCKED 2026-11-11 |
| Rate limiting store | Redis — same VPS, localhost only, maxmemory 64MB | LOCKED 2026-11-11 |
| Bot protection | Cloudflare Turnstile (server-side verify mandatory, fail closed) | LOCKED 2026-11-11 |
| Payment provider | Razorpay | LOCKED 2026-11-09 |
| Edge / security | Cloudflare (DNS + proxy + WAF + Turnstile) | LOCKED |

## 2. VPS — 1GB RAM, Oracle Linux, 50GB

VPS: **1GB RAM, Oracle Linux, 50GB storage** (Always Free E2.1.Micro shape). Isi constraint ne stack decide kiya:

- Go API measured: idle 4MB / peak 16MB; Node 16/88MB, FastAPI 31/53MB. Go API + Postgres = ~370MB peak — 1GB me fit.
- **Postgres tuning (1GB ke liye):** `shared_buffers = 192MB`, `effective_cache_size = 512MB`,
  `work_mem = 4MB`, `maintenance_work_mem = 64MB`, `max_connections = 30`, `max_wal_size = 1GB`,
  autovacuum on. **1GB swap file** bhi banana hai — spike pe OOM se bachata hai.
- App + DB ek hi box pe honge — isliye **nightly `pg_dump` backup off-VPS** zaroori hai.
- **Cloudflare Tunnel:** `cloudflared` daemon ~10–20MB RAM leta hai — 1GB budget me aaram se fit. Tunnel
  outbound-only connection banata hai, isliye VPS ke 80/443 ports public internet pe khulne hi nahi —
  origin IP expose nahi hota.
- **Redis (same VPS):** localhost only (`bind 127.0.0.1`), password/ACL, systemd service, no public
  port. `maxmemory 64MB`, `maxmemory-policy allkeys-lru` — poora 1GB kha nahi sakta. Budget: Go
  ~16MB peak + Postgres ~370MB + cloudflared ~10–20MB + Redis 64MB + nginx ~10MB = ~480MB — 1GB
  ke andar; 1GB swap safety net hai. Redis sirf ephemeral data ke liye hai (§6.6) — sessions
  Postgres me rehte hain.
- **Upgrade path:** Oracle Always Free me Ampere A1 Flex bhi milta hai — **2 OCPU + 12GB total**
  (Oracle docs se verify kiya; June 2026 me 4 OCPU/24GB se halve hua tha). A1 pe Kratos bhi chal jaayega.
  Dhyaan: A1 instance 7 din idle raha to Oracle reclaim kar sakta hai.

**Rejected (kyun):** Ory Kratos 1GB pe nahi — Argon2 defaults 64MB/hash, Ory ka calibrate tool 1GB
dedicated hashing memory maangta hai, 32 login/min pe 1.10GB use hua (test). Keycloak (800MB–2GB) aur
Zitadel (150–300MB + AGPL-3.0) bhi 1GB pe tight hain. Oracle Autonomous AI Database reject — free tier me
backup/restore nahi hai, Go driver ko CGO + Instant Client + wallet chahiye, AI features is CRUD app ke
liye irrelevant hain. Clerk/Auth0 reject — hosted SaaS, cookie-SSO design se match nahi karte, limit ke baad
per-user billing. Fly.io/Render, Turso/Neon reject — hosting VPS pe lock hai.

## 3. Architecture

- Go API VPS pe chalegi (binary + systemd service, GitHub Actions se deploy). Bahar se reachable sirf
  Cloudflare Tunnel se hogi — `cloudflared` VPS pe chalega, Go API `localhost:8080` pe sunegi. Koi inbound
  port nahi khulta.
- Postgres same VPS pe. nginx reverse proxy + rate limiting (tunnel ke peeche, `localhost` pe).
  Cloudflare edge aage (proxy + WAF + DDoS + rate limit).
- Frontend (account/admin/home/web) Cloudflare Pages pe static hai; API se cookie session se baat karega.
- Rate limiting / OTP counters Redis me hain (ephemeral); sessions Postgres me hain (source of truth).

### 3.1 Endpoints — dev vs production (LOCKED 2026-11-11)

**Backend build karte time free URLs hi use honge — custom domain nahi.** Domain (`kumbuild.com`) abhi
khareeda nahi hai; sab kuch final hone ke baad hi domain add hoga. Tab sirf DNS + env change hoga, code
dobara nahi likhna padega.

**Development (abhi):**
- Frontend — Cloudflare Pages free URLs (2026-11-11 ko live verify kiye, sab HTTP 200):
  web `https://kumbuild-web.pages.dev`, account `https://kumbuild-account.pages.dev`,
  admin `https://kumbuild-admin.pages.dev`, home `https://kumbuild-home.pages.dev`,
  blog `https://kumbuild-blog.pages.dev`, docs `https://kumbuild-docs.pages.dev`,
  legacy app `https://kumbuild-app.pages.dev`.
- API — Cloudflare **Quick Tunnel**: `cloudflared tunnel --url http://localhost:8080` se random
  `https://<random>.trycloudflare.com` URL milta hai (HTTPS, koi account/domain nahi chahiye).
  **Limits (Cloudflare docs, Exa-verified 2026-11-11):** URL har restart pe badalta hai — har baar naya
  URL leke frontend ko rebuild + redeploy karna padega; koi uptime guarantee nahi; max 200 in-flight
  requests (uske upar 429); SSE support nahi; sirf testing/development ke liye hai. Isliye `cloudflared`
  ko systemd service bana ke chalao taaki restart kam ho.
- **CORS:** backend ki allowed-origins list me saato `*.pages.dev` URLs + localhost ports daalne honge.
  Frontend API ko call karta hai (browser se) — backend frontend ko call nahi karta.
  **CORS security nahi hai** — ye sirf browser ko rokta hai; curl/Postman se koi bhi API hit kar sakta hai.
  Asli protection login/session auth hai (§6).
- **Cookie (dev):** `SameSite=None; Secure` — frontend aur API alag sites hain (`pages.dev` vs
  `trycloudflare.com`), isliye Lax cookie browser bhejega hi nahi. `Domain` attribute dev me nahi lagega
  (koi shared parent domain nahi hai).

**Production (domain ke baad):**
- API — Cloudflare **Named Tunnel**: `cloudflared tunnel create kumbuild-api` + `cloudflared tunnel route
  dns kumbuild-api api.kumbuild.com`. Quick tunnel (trycloudflare) production me nahi — URL badalta hai,
  koi SLA nahi, aur SSO cookie (`Domain=.kumbuild.com`) uspe chalegi nahi.
- Frontend — `kumbuild.com` + subdomains (`account`/`admin`/`home`/`blog`/`docs`).
- **Cookie (prod):** HttpOnly + Secure + `SameSite=Lax` + `Domain=.kumbuild.com`, 7 din — teeno apps +
  web pe SSO chalega.
- Named tunnel ko systemd service se chalao; HA ke liye ek hi tunnel ke 2 `cloudflared` connectors chala
  sakte ho (ek band ho to doosra tunnel zinda rakhta hai).

- Role check **har API call pe backend karega** — frontend guard sirf UX hai, security nahi.

## 4. Data model

Mock shapes (`frontend/packages/lib/src/mock.ts`) se liye gaye — backend inhe tables banayega:

**Order (16 fields):** `id` (ORD-1001…), `businessName`, `businessType`, `customerName`, `customerEmail`,
`customerPhone`, `packageName` (Starter|Business|Premium), `price` (₹), `advancePaid`, `status`,
`orderedOn`, `revisionsUsed`, `previewUrl`, `liveUrl`, `renewalDate`, `notes`.
`OrderStatus`: `received | in-progress | preview-ready | revision | approved | live`.
`PACKAGE_PRICE`: Starter 3999, Business 7999, Premium 14999.

**Customer (7 fields):** `id` (CUS-01…), `name`, `email`, `phone`, `businessName`, `orders` (count),
`joinedOn`. **Order me `customerId` FK jodna hoga** — aaj sirf email string se link hai.

**Payment (8 fields):** `id` (PAY-01…), `orderId`, `businessName`, `kind` ("Advance (50%)" | "Final (50%)" |
"Renewal"), `amount` (₹), `method` ("UPI" | "Card" | "NetBanking"), `status` ("Paid" | "Pending"),
`date`. **Razorpay fields jodne honge** — `razorpayOrderId`, `razorpayPaymentId`, signature verify status,
webhook status, refund fields. Contract me amounts **paise (integer)** me honge (₹3,999 = 399900).

**User (auth):** `id` (uuid PK), `full_name` (required), `email` (unique, citext),
`password_hash` (Argon2id — kabhi plaintext nahi), `phone_no` (required, E.164, India +91),
`whatsapp_no` (required, E.164 — phone_no jaisa bhi ho sakta hai, "same as phone" checkbox),
`alternative_email` (optional, valid email, primary se alag, diya ho to unique),
`role` (super_admin | admin | customer_service | customer — ek user ka ek role),
`status` (active | disabled | pending | invited), `email_verified_at` (nullable),
`created_at`, `updated_at`.
Signup / user-create pe **saare fields collect aur store honge, koi field drop nahi hogi** —
validation server-side hai, frontend pe nahi. **Exactly ONE super_admin hai (Dus)** — doosra
kabhi nahi ban sakta (§5 guards). Staff (admin/customer_service) ka self-signup nahi hota —
sirf invite se. Phone OTP scope me nahi hai — verification email OTP se hi hogi.

**Billing address (customer ONLY):** alag `billing_addresses` table — `id`, `user_id` FK (unique),
`billing_name`, `address_line1`, `address_line2` (optional), `city`, `state`, `pincode`
(6-digit India), `country` (default India), `gstin` (optional — format validate karo:
`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`), `created_at`, `updated_at`.
Staff ke liye billing address nahi banta.

**Sessions:** `id`, `user_id` FK, `token_hash` (SHA-256), `created_at`, `expires_at` (7 din absolute),
`last_seen_at` (idle timeout 24h — 24h bina activity ke session khatam), `ip`, `user_agent`.
**Auth tokens (OTP + reset + invite — ek table):** `id`, `user_id` FK, `kind` (otp | reset |
invite), `token_hash`, `expires_at` (OTP 10 min, reset 30 min, invite 24h), `used_at`, `attempts`.
Invite token reset token ki tarah use nahi ho sakta — kind check hoga.
**Audit logs:** `id`, `actor_user_id`, `action`, `target_user_id`, `details` (jsonb — role/status
ki before/after values), `ip`, `created_at`.
**Order notes (customer service):** `id`, `order_id` FK, `author_user_id` FK, `note` (text),
`created_at` — customer-service "read + notes" isi se banta hai.

**Backend ko aur jodna hoga:** `Revision` entity (round, changes, dates, chargeable flag);
`Refund` entity + `cancelled`/`on-hold` statuses; `Website` entity (domain, hosting, renewalDate) ya Order pe
fields; per-order content-checklist (services, address, timing, photos, logo, social links);
`Lead`/order-intent (agar form backend likhega — decision §9).

## 5. API contract

Base: `/api` (proposal), `api.kumbuild.com` pe. Har call pe auth + role check. Amounts paise me.

**Auth (account app):** har mutating endpoint pe Turnstile token mandatory hai (signup, login,
forgot-password, reset-password, accept-invite) — §6.4 dekho. CSRF double-submit token bhi har
state-changing cookie endpoint pe lagta hai (§6.5).

| Endpoint | Notes |
|---|---|
| `POST /auth/signup` | `{full_name, email, password, phone_no, whatsapp_no, alternative_email?, billing_*}` → 201 `{user}` + cookie. Sirf customer banta hai; role `customer` force hai. Password policy §6.3. Phone/WhatsApp E.164 server-side validate karo; billing address `billing_addresses` me jaata hai. Email verify OTP se hogi (signup = OTP verify). Errors: `invalid-*` (400), `exists` (409) |
| `POST /auth/login` | `{email, password}` → 200 `{user}` + cookie. `pending`/`invited` status ho to 401 (invite accept kiye bina login nahi). Errors ek "invalid credentials" me collapse karo (account enumeration rokne ke liye) |
| `POST /auth/logout` | Cookie clear + server pe session khatam karo |
| `GET /auth/me` | 200 `{user}` ya 401. Response me `role` bhi aata hai (frontend routing ke liye, baad me) |
| `POST /auth/forgot-password` | `{email}` → hamesha 200 generic (email hai ya nahi, ye leak mat karo) |
| `POST /auth/reset-password` | `{token, newPassword}` — token kind `reset` hi chalega (invite token nahi). Reset pe us user ke **saare sessions invalidate karo**. Nayi `/reset-password` page bhi banani hogi (route aaj nahi hai) |
| `POST /auth/accept-invite` | `{token, newPassword}` — token kind `invite` hi chalega (reset token nahi). Password set hote hi email auto-verified + status `invited` → `active`. Token single-use, 24h expiry |
| `POST /auth/change-password` | requireAuth. `{currentPassword, newPassword}` → baaki saare sessions invalidate (current chalu rehta hai) |

**Password policy (§6.3, ek jagah define — signup, accept-invite, reset, change pe lagu):**
min 8 chars, kam se kam 1 uppercase + 1 lowercase + 1 digit + 1 special char; HIBP breach
check signup/change pe; Argon2id hash only.

**User management (super_admin hi — `POST /admin/users` ek hi endpoint hai, role check handler ke andar):**

| Endpoint | Notes |
|---|---|
| `GET /admin/users?role=&status=&q=&page=` | super_admin — list, paginated |
| `POST /admin/users` | **Ek hi endpoint.** Handler ke andar role check: super_admin → `admin` / `customer_service` / `customer` bana sakta hai (`super_admin` role kabhi nahi — exactly one hai). Admin → sirf `customer` bana sakta hai (role force `customer`). Customer_service → koi user nahi bana sakta (403). Staff (admin/customer_service) banane pe invite email jaata hai (kind=`invite`, 24h); customer banane pe OTP verify mail (status `pending` jab tak verify na ho). Saare §2 fields collect karo — koi field drop nahi |
| `GET /admin/users/:id` | super_admin |
| `PATCH /admin/users/:id/role` | super_admin — role change turant lagoo (role har request pe DB se load hota hai). Only super_admin ko demote nahi kar sakte; khud ka role change nahi |
| `PATCH /admin/users/:id/status` | super_admin — disable/enable. Disable karte hi us user ke **saare sessions delete** (turant logout). Only super_admin ko disable nahi kar sakte; khud ko disable nahi |
| `POST /admin/users/:id/reset-password` | super_admin — force reset: saare sessions invalidate + reset mail |
| `POST /admin/users/:id/resend-invite` | super_admin — dobara invite bhejo; **purana invite token invalidate** ho jaata hai. Sirf `invited` status wale user pe |
| `GET /admin/audit-logs` | super_admin — actor, target, action, before/after role+status, IP, timestamp |

**Guards (server pe):** exactly ONE super_admin (Dus) — doosra `super_admin` kabhi nahi ban sakta
(POST /admin/users me role=`super_admin` aaye to 403; seed CLI bhi abort karta hai agar ek pehle se
hai). Admin sirf customer bana sakta hai, kabhi staff nahi. Customer_service koi user nahi bana sakta.
Galat role se endpoint → 403; disabled → 401.

**Order notes (customer service — "read + notes" isi se banta hai):**
`POST /admin/orders/:id/notes` (admin, customer_service, super_admin — `{note}` → 201) aur
`GET /admin/orders/:id/notes` (wahi roles — list, latest pehle). Notes `order_notes` table me.

**Customer reads (home app — sirf reads):** `GET /customers/me`, `GET /orders?mine=true` (customer session se
derive karo — client-sent email pe kabhi bharosa mat karo), `GET /orders/:id` (doosre customer ka order ho to
bhi 404), `GET /orders/:id/payments` ya pending payments batch endpoint.

**Admin:** `GET /admin/dashboard`, `GET /admin/orders?status=&q=&page=&limit=`, `GET /admin/orders/:id`,
`POST /admin/orders`, `PATCH /admin/orders/:id/status` (valid transitions: received → in-progress →
preview-ready → revision ⇄ preview-ready → approved → live), `PATCH /admin/orders/:id`,
`POST /admin/orders/:id/preview`, `POST /admin/orders/:id/revisions`,
`POST /admin/orders/:id/approve`, `POST /admin/orders/:id/go-live`,
`POST /admin/orders/:id/payment-link`, `POST /admin/payments/:id/refund`,
`POST /admin/orders/:id/cancel` + `/hold` (status define karna hoga),
`GET /admin/customers` (+ `/:id`), `GET /admin/builds`, `GET /admin/payments`,
`GET /admin/me`, `PATCH /admin/me`.

**Webhooks:** `POST /webhooks/razorpay` — signature verify **backend pe, kabhi frontend pe nahi**; payment
status sync; frontend ki "paid" baat pe bharosa nahi.

**Frontend wiring:** `packages/lib` me `api-client` (fetch wrapper) **likhna hoga** — ARCHITECTURE.md kehta hai
ye hai, par file exist hi nahi karti. Base URL env se, cookie credentials, har call site rewire karna hoga,
aur loading/error states jodne honge (aaj koi nahi hai).

## 6. Auth design

- **Sessions, JWT nahi** — browser app ke liye session cookie behtar hai (revoke ho jaati hai: row delete karo,
  logout ho gaya). Cookie me 32+ random bytes ka token; DB me sirf uska SHA-256 hash. Login ke baad session
  regenerate karo (fixation rokne ke liye). **Expiry (define kar diya):** 7 din **absolute expiry** (login se
  7 din, kabhi extend nahi hoti) + **idle timeout 24h** (24h bina activity ke session khatam; har request pe
  `last_seen_at` update hota hai). Sliding sirf idle timeout ke liye hai — absolute expiry fixed hai.
- **Cookie:** HttpOnly + Secure + 7 din, server-side expiry enforce karo. **Prod:** SameSite=Lax +
  `Domain=.kumbuild.com` (SSO). **Dev:** SameSite=None + Secure, koi `Domain` nahi — frontend
  (`*.pages.dev`) aur API (trycloudflare) alag sites hain, isliye Lax cookie browser bhejega hi nahi (§3.1).
- **Password hashing:** Argon2id (`golang.org/x/crypto/argon2`) — OWASP recommendation. 1GB box ke liye tune
  karo (**19–32MB/hash, t=2, p=1** — OWASP minimum 19 MiB; max 2 concurrent hashes) — OOM se bachne ke liye.
  Bcrypt bhi chalega (cost 11–12, 72-byte limit ka dhyaan rakho). Kabhi plaintext / SHA / MD5 nahi.
- **Password policy (ek jagah define — signup, accept-invite, reset, change pe lagu):** min 8 chars, kam se
  kam 1 uppercase + 1 lowercase + 1 digit + 1 special char; HIBP breach check signup/change pe.
- **Email verification + OTP:** 6-digit OTP code primary hai (cross-device kaam karta hai — phone pe padho,
  laptop pe type karo; mail scanners use consume nahi kar sakte). Code: hash store karo, single-use, 10 min
  expiry, 5 attempts. Magic link secondary/fallback. Reset token: 32-byte, hash store karo, 30 min expiry,
  reset pe us user ke **saare sessions invalidate karo**.
- **Email verification policy (fix hai):** signup = OTP verify (status `pending` jab tak verify na ho);
  invite = password set hote hi auto-verified (invite hi mailbox ka proof hai); staff = invite only,
  staff roles ka self-signup nahi hota.
- **Rate limiting (Redis, §6.6):** login/signup pe 5/min per-IP (aur per-email bhi). Redis down ho to fail
  safe — throttling bypass nahi hogi: login/signup/forgot/reset/accept-invite **503** + log. Generic errors —
  "no such user" vs "wrong password" ek jaisa rakho.
- **Turnstile (§6.4):** signup, login, forgot-password, reset-password, accept-invite pe mandatory.
  Server-side verify fail closed — kabhi client-side widget pe bharosa nahi.
- **CSRF (§6.5):** SameSite + Origin check akela kaafi nahi — state-changing cookie endpoints pe
  double-submit CSRF token mandatory hai.
- **Admin seeding:** one-time CLI `api seed-admin --email <dus-email>`, hidden password prompt; abort
  agar koi super_admin pehle se hai. **Exactly ONE super_admin (Dus)** — doosra kabhi nahi ban sakta (§5).
  Signup sirf customer banata hai; staff sirf invite se banta hai.
- **`?demo_session=` delete karo, port mat karo** — unsigned base64 handoff mock-phase ka tha.

### 6.4 Turnstile (poora spec — sirf naam nahi)

- **Kahan lagta hai:** signup, login, forgot-password, reset-password, accept-invite — har form pe
  frontend widget (public sitekey) + backend verify (secret key).
- **Backend verify (mandatory):** `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`
  with `secret` (env se, kabhi frontend code me nahi), `response` (token), `remoteip`.
  Response ka `success` true hona chahiye, warna request reject.
- **Token rules:** token 300 seconds ka hota hai, single-use; validation fail / timeout / duplicate
  ho to **fail CLOSED** (request block, generic error). Client-side widget pe kabhi bharosa nahi —
  widget pass hua to bhi server verify karega.
- **Keys:** dev me Cloudflare ke test sitekey/secret use karo; production keys sirf prod env me.
  Secret kabhi frontend code, repo, ya log me nahi.
- **Logging:** failed validations log karo (endpoint, IP, timestamp, reason) — abuse dikhe to rate limit
  badha sakte ho.

### 6.5 CSRF

- SameSite=Lax (prod) / None+Secure (dev) akela kaafi nahi — dev me `SameSite=None` wali cookie
  cross-site request pe bhi bheji jaati hai, isliye CSRF token zaroori hai.
- **Double-submit cookie pattern:** server `csrf_token` cookie set karta hai (random, per-session,
  `SameSite=Lax` prod / `None; Secure` dev, **HttpOnly nahi** — JS ko padhna hai) aur frontend har
  state-changing request (POST/PATCH/PUT/DELETE) pe `X-CSRF-Token` header me wahi value bhejta hai.
  Middleware dono ko match karta hai — mismatch ho to 403.
- Token har session ke saath rotate hota hai; GET endpoints pe CSRF check nahi lagta (safe methods).
- Saath me **Origin/Referer check** bhi: state-changing request ka `Origin` header allowed origins
  (pages.dev list / prod domains) me hona chahiye, warna 403.

### 6.6 Redis (rate limiting store — sessions yahan nahi)

- **Kya store hota hai (sirf ephemeral):** login rate limit counters (5/min per-IP + per-account),
  OTP attempt counters, Turnstile/login throttling cache. TTL har key pe set hota hai.
- **Sessions Redis me NAHI hain** — sessions Postgres me hain (source of truth, SHA-256 token hash).
- **Redis down ho to:** fail safe — throttling bypass nahi hogi. Login/signup/forgot/reset/accept-invite
  **503 + log** karenge (Postgres fallback baad ka option hai, abhi scope me nahi). Read-only endpoints
  (GET) Redis ke bina chalte rahenge.
- **Config (VPS):** `bind 127.0.0.1`, password/ACL, systemd service, no public port,
  `maxmemory 64MB`, `maxmemory-policy allkeys-lru` — budget §2 dekho.

## 7. Email (Brevo — LOCKED 2026-11-11; Resend OUT)

- **Brevo free tier (Exa-verified 2026-11-11, Brevo help docs):** 300 emails/day, no credit card,
  no time limit; unused quota agle din roll over **nahi** hoti. Daily limit ke baad transactional ke
  liye 1,000 tak ki retry queue hoti hai; usse zyada deliver nahi hote.
- **Kaise bhejte hain:** official Go SDK `getbrevo/brevo-go` (`SendTransacEmail` → POST
  `https://api.brevo.com/v3/smtp/email`, `api-key` header) — ya plain REST. API key sirf env/GitHub
  Secrets me — kabhi code me nahi. SMTP relay bhi available hai, par REST + SDK primary hai.
- **Do alag identities/templates:** transactional (OTP, invite, reset, order mails) vs promotional
  (offers, updates). Promotional **sirf opted-in users** ko, unsubscribe link ke saath; jisne opt-in
  nahi kiya use promotional kabhi nahi.
- **Daily limit handling:** transactional mails DB-backed outbox se jaayenge (har send attempt + status
  log hoga), retry hoga, bounced/failed sends log honge. **OTP kabhi silently drop nahi hoga** — limit
  lagne pe OTP send clear error dega (500 + "email limit reached, try again later"), fake success nahi.
- Domain khareedne ke baad **SPF + DKIM + DMARC** lagana hoga; transactional ke liye alag subdomain
  (jaise `mail.kumbuild.com`) ho sake to. Deliverability provider se zyada domain + behaviour pe depend
  karti hai.

## 8. Payments (Razorpay LOCKED)

- Provider: Razorpay (LOCKED 2026-11-09), fee 2% + 18% GST = 2.36% effective.
- Flow (docs me 2 versions takrate hain — decision §9): (a) admin haath se payment link bhejega (PLAN kehta hai),
  ya (b) backend Razorpay Order banata hai + Checkout khulta hai (PAYMENTS.md kehta hai). **Recommendation:
  payment links se shuru karo** — aaj ka manual flow wahi hai.
- 50% rounding: mock kehta hai advance = ceil(price/2) (₹3,999 → ₹2,000 + ₹1,999); PAYMENTS.md kehta hai
  ₹1,999.50. **Recommendation: advance = ceil, final = price − advance.** Razorpay ko paise me integer chahiye.
- Order lifecycle (6-stage): Received → In progress → Preview ready → Revision → Approved → Live.
  Advance milna Received ki precondition hai; final 50% Live ki precondition hai. Delivery clock: advance +
  poora content milne ke 3–5 working days baad preview.
- **`approved` ka matlab:** mock + DELIVERY "Approval aur go-live" kehte hain approved-but-unpaid;
  DELIVERY stages table kehta hai approved-and-paid. **Recommendation: approved-but-unpaid.**
- **`On hold` / `cancelled`:** DELIVERY/REFUND maangte hain, `OrderStatus` me nahi hain — define karna hai
  (7 din no-response → On hold; cancel flow bhi).
- Refund (DRAFT): kaam shuru hone se pehle advance full refund; kaam shuru hone ke baad nahi; Kumbuild ki galti
  pe full refund; Razorpay se original method pe, 7 working days me check ke baad.

## 9. Open decisions (build se pehle / build ke dauraan)

1. **Payment mechanism** — Razorpay Payment Links vs Razorpay Order + Checkout (§8).
2. **50% rounding** — advance = ceil (recommendation) vs exact halves.
3. **Order creation** — admin-only (docs as written) vs web form se lead/intent record.
4. **`approved` semantics** — approved-but-unpaid (recommendation) vs approved-and-paid.
5. **`on-hold` / `cancelled`** — 7th status ya flag + `lastContactedOn`? Cancel ka flow?
6. **Admin seeding** — RESOLVED 2026-11-11: one-time CLI `api seed-admin --email <dus-email>` (hidden
   password prompt); exactly ONE super_admin (Dus) — doosra kabhi nahi. Staff invite se banta hai.
7. **Email verification policy** — RESOLVED 2026-11-11: signup = OTP verify; invite = password set pe
   auto-verified; staff = invite only, self-signup nahi (§6).
8. **Password policy** — RESOLVED 2026-11-11: min 8 chars, 1 uppercase + 1 lowercase + 1 digit +
   1 special char; HIBP check; Argon2id 19–32MB, t=2, p=1, max 2 concurrent (§6.3).
9. **Session cookie policy** — RESOLVED 2026-11-11: 7 din absolute + 24h idle timeout; prod HttpOnly +
   Secure + SameSite=Lax + `Domain=.kumbuild.com`; dev SameSite=None + Secure, no Domain (§3.1/§6).
10. **Go framework** — stdlib + chi (recommendation) vs gin/echo.
11. **Preview/live hosting** — preview sites kahan host hongi, domain/SSL/deploy kaun karega.
12. **Renewal flow** — reminder kaun bhejega, non-payment pe kya hoga.
13. **Notifications** — WhatsApp manual hi rahega ya automation (WhatsApp Business API)?
14. **Pricing finality** — saari prices DRAFT hain; pricing DB-driven hogi ya docs me rahegi?
15. **GST** — prices inclusive ya exclusive (kahin nahi likha).

## 10. Security — hack aur DDoS se bachav (sab free)

Layers, bahar se andar:

1. **Cloudflare Tunnel (connectivity):** VPS ka koi inbound port nahi khulta — `cloudflared` outbound-only
   connection banata hai, isliye origin IP public internet pe dikhta hi nahi. Tunnel mode me UFW ko 443
   allow karne ki zaroorat nahi (neeche layer 3 dekho). Dev me quick tunnel (`trycloudflare.com`),
   production me named tunnel (`api.kumbuild.com`) — §3.1.
2. **Cloudflare (edge):** unmetered DDoS mitigation, managed WAF, Bot Fight Mode, **1 rate-limiting rule**
   (Free = 1 rule, 10s window) — login endpoint pe lagao (POST /auth/login, 5–10/min per IP, Block).
   Turnstile (free, CAPTCHA puzzle nahi) signup/login/forgot/reset/accept-invite forms pe — server-side
   verify mandatory (§6.4), fail closed. "Under Attack Mode" panic button hai.
3. **Origin lock (UFW):** tunnel mode me sirf SSH (22, key-only) khula rakho — 80/443 band rahenge.
   (Agar kabhi tunnel ke bina direct serve karna pade to sirf Cloudflare ke IP ranges ko 443 pe allow karo.)
4. **nginx (VPS pe):** `limit_req` zones — login 10/min, API 10/sec, general 30/sec; connection limits;
   timeouts (Slowloris se bachav); 429 responses.
5. **Redis (rate limiting store, VPS localhost):** login 5/min per-IP + per-account, OTP attempt counters,
   Turnstile/login throttling cache — sab ephemeral. Redis down ho to fail safe: login/signup/forgot/reset/
   accept-invite 503 + log; throttling kabhi silently bypass nahi hogi (§6.6).
6. **fail2ban:** sshd jail + nginx-limit-req jail. **Caveat:** Cloudflare ke peeche plain IP ban Cloudflare ko
   ban kar deta hai — `cloudflare-token` action use karo (edge pe block hota hai).
7. **App level:** per-IP + per-account login throttling, Turnstile, HIBP breach check, generic errors,
   password change pe saare sessions invalidate, security headers (HSTS, CSP, X-Content-Type-Options), TLS 1.2+,
   CSRF double-submit token (§6.5).
8. **VPS hygiene:** SSH key-only, UFW (tunnel mode me sirf 22; 80/443 band), security updates auto, secrets sirf env/GitHub Secrets
   me (kabhi code me nahi), nightly `pg_dump` backup off-VPS.

## 11. Deploy

- `.github/workflows/deploy-backend.yml` se Oracle VPS pe deploy (Go binary + systemd service; VPS SSH secrets
  GitHub Secrets me). Workflow + secrets setup backend build ke time pe — VPS connection details secure flow se
  dene honge, chat me kabhi nahi.
- **Cloudflare Tunnel setup (deploy ke time):** `cloudflared` install karo + systemd service banao
  (restart pe khud start ho). **Dev:** quick tunnel — `cloudflared tunnel --url http://localhost:8080`,
  jo `trycloudflare.com` URL dega; restart pe URL badlega, to frontend rebuild + redeploy karna hoga.
  **Prod (domain ke baad):** named tunnel banao (`cloudflared tunnel create kumbuild-api`) aur
  `cloudflared tunnel route dns kumbuild-api api.kumbuild.com` se route karo; HA ke liye 2 connectors.
- **Redis install (deploy ke time):** VPS pe Redis install karo — localhost only (`bind 127.0.0.1`),
  password/ACL, systemd service, `maxmemory 64MB`, `maxmemory-policy allkeys-lru` (§2 budget, §6.6).
- **Domain abhi khareeda nahi hai** — backend build karte time free URLs hi use honge (frontend
  `*.pages.dev`, API trycloudflare quick tunnel). Production ko domain chahiye: `api.kumbuild.com` + SSO
  cookie domain ispe depend karte hain; domain aane pe sirf DNS + env change hoga (§3.1).
- Frontend (Pages) ko API base URL env se milega — dev me trycloudflare URL, prod me `api.kumbuild.com`.

## 12. Build order

**A–E = auth build (is task ka scope).** 4–6 (payments / admin actions / renewals) auth ke baad aayenge.

| Phase | Kaam |
|---|---|
| **0. Docs theek karo** | `backend/auth`, `backend/orders`, `backend/chat` READMEs rewrite karo (is file se match); PLAN §9 counts theek karo |
| **A. Schema + skeleton** | Go module + REST routes (§5) + DB schema/migrations (users — saare §2 fields — + sessions/auth_tokens/audit_logs/order_notes/billing_addresses) + Redis client + Brevo mailer + Turnstile verify; auth middleware (cookie + role check + CSRF) |
| **B. Core auth** | signup/login/logout/me/forgot/reset + accept-invite + change-password + Argon2id (19MB min) + cookie policy (7d absolute + 24h idle) + OTP + Turnstile + CSRF; `?demo_session=` delete karo (account app rewire + `/reset-password` page — frontend phase me, baad me) |
| **C. Roles + user management** | GET/PATCH /admin/users (single POST endpoint, role check handler ke andar) + guards (exactly one super_admin) + invite/resend-invite + order notes endpoints + audit log har action pe |
| **4. Payments** | Razorpay payment link ya Order+Checkout (§9 decision), signature verify, webhook; `Payment` me Razorpay fields |
| **5. Admin actions** | Status change, preview publish, revisions, approve, go-live, renewalDate rule, refunds/cancel/hold; audit trail; NewOrderPage 9-field bug fix; Dashboard title fix |
| **6. Renewals + content** | Renewal flow + reminders, content-checklist per order, delivery-clock rule |
| **D–E. Seed + checks + Deploy (dev)** | seed-admin CLI + manual test checklist (har role login, galat role → 403, disabled → 401, role change immediate, disable → immediate logout, invite → set password → login, Turnstile fail → blocked, Redis down → safe failure, Brevo limit → queued/logged) + `deploy-backend.yml` se Oracle VPS pe deploy + Redis install + `cloudflared` systemd service (dev: quick tunnel, prod: named tunnel) + Pages env (API base URL) + domain khareedne ke baad `api.kumbuild.com` DNS + SSO cookie domain switch; dev poora free URLs pe chalega (§3.1) |

Full analysis: `~/workspace/shot-tools/kumbuild-audit/BACKEND_BUILD_PLAN.md` (local, repo ke bahar).
