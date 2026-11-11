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
| API | `api.kumbuild.com` | LOCKED |
| Auth | Custom Go auth (session cookie, neeche §6 dekho) | LOCKED 2026-11-11 |
| Email | Resend (free tier) | LOCKED 2026-11-11 |
| Payment provider | Razorpay | LOCKED 2026-11-09 |
| Edge / security | Cloudflare (DNS + proxy + WAF + Turnstile) | LOCKED |

## 2. VPS — 1GB RAM, Oracle Linux, 50GB

VPS: **1GB RAM, Oracle Linux, 50GB storage** (Always Free E2.1.Micro shape). Isi constraint ne stack decide kiya:

- Go API measured: idle 4MB / peak 16MB; Node 16/88MB, FastAPI 31/53MB. Go API + Postgres = ~370MB peak — 1GB me fit.
- **Postgres tuning (1GB ke liye):** `shared_buffers = 192MB`, `effective_cache_size = 512MB`,
  `work_mem = 4MB`, `maintenance_work_mem = 64MB`, `max_connections = 30`, `max_wal_size = 1GB`,
  autovacuum on. **1GB swap file** bhi banana hai — spike pe OOM se bachata hai.
- App + DB ek hi box pe honge — isliye **nightly `pg_dump` backup off-VPS** zaroori hai.
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

- Go API `api.kumbuild.com` pe chalegi, Oracle VPS pe (binary + systemd service, GitHub Actions se deploy).
- Postgres same VPS pe. nginx reverse proxy + rate limiting. Cloudflare aage (proxy + WAF + DDoS).
- Frontend (account/admin/home/web) Cloudflare Pages pe static hai; API se cookie session se baat karega.
- Session: HttpOnly cookie `Domain=.kumbuild.com` — teeno apps + web pe SSO chalega.
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

**Backend ko aur jodna hoga:** `User.id` (PK) + password hash + reset tokens + session records;
`createdAt`/`updatedAt` + status-history/audit; `Revision` entity (round, changes, dates, chargeable flag);
`Refund` entity + `cancelled`/`on-hold` statuses; `Website` entity (domain, hosting, renewalDate) ya Order pe
fields; per-order content-checklist (services, address, timing, photos, logo, social links);
`Lead`/order-intent (agar form backend likhega — decision §9).

## 5. API contract

Base: `/api` (proposal), `api.kumbuild.com` pe. Har call pe auth + role check. Amounts paise me.

**Auth (account app):**
| Endpoint | Notes |
|---|---|
| `POST /auth/signup` | `{name, email, password}` → 201 `{user}` + cookie. Sirf customer banta hai. Errors: `invalid-name` / `invalid-email` / `short-password` (400), `exists` (409) |
| `POST /auth/login` | `{email, password}` → 200 `{user}` + cookie. Errors ek "invalid credentials" me collapse karo (account enumeration rokne ke liye) |
| `POST /auth/logout` | Cookie clear + server pe session khatam karo |
| `GET /auth/me` | 200 `{user}` ya 401 |
| `POST /auth/forgot-password` | `{email}` → hamesha 200 generic (email hai ya nahi, ye leak mat karo) |
| `POST /auth/reset-password` | `{token, newPassword}` — nayi `/reset-password` page bhi banani hogi (route aaj nahi hai) |

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
  regenerate karo (fixation rokne ke liye).
- **Cookie:** HttpOnly + Secure (prod) + SameSite=Lax + `Domain=.kumbuild.com`, 7 din. Server-side expiry
  enforce karo.
- **Password hashing:** Argon2id (`golang.org/x/crypto/argon2`) — OWASP recommendation. 1GB box ke liye tune
  karo (16–32MB/hash, max 2 concurrent hashes) — OOM se bachne ke liye. Bcrypt bhi chalega (cost 11–12, 72-byte
  limit ka dhyaan rakho). Kabhi plaintext / SHA / MD5 nahi.
- **Email verification + OTP:** 6-digit OTP code primary hai (cross-device kaam karta hai — phone pe padho,
  laptop pe type karo; mail scanners use consume nahi kar sakte). Code: hash store karo, single-use, 10 min
  expiry, 5 attempts. Magic link secondary/fallback. Reset token: 32-byte, hash store karo, 30 min expiry,
  reset pe us user ke **saare sessions invalidate karo**.
- **Breach check:** Have I Been Pwned range API se signup/password-change pe check karo (free, k-anonymity).
- **Rate limiting:** login/signup pe 5/min per-IP (aur per-email bhi). Generic errors — "no such user" vs
  "wrong password" ek jaisa rakho.
- **Admin seeding:** signup sirf customer banata hai — admin kaise banta hai, ye define karna hai (seed script?).
  TBD (§9).
- **`?demo_session=` delete karo, port mat karo** — unsigned base64 handoff mock-phase ka tha.

## 7. Email (Resend)

- **Resend free tier:** 3,000/month, 100/day, official Go SDK, card nahi chahiye. Sab mail ek se:
  verification OTP, password reset, order confirmation/status update.
- Backup option: Mailtrap (4,000/month). Postmark ki deliverability sabse best hai, par free sirf 100/month.
- Domain khareedne ke baad **SPF + DKIM + DMARC** lagana hoga, aur reset mails ko alag subdomain se bhejo —
  deliverability provider se zyada domain + behaviour pe depend karti hai.

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
6. **Admin seeding** — sirf Dus ya admin-user table? Reset flow admin ke liye?
7. **Email verification policy** — verify-first, verify-later, ya kabhi nahi.
8. **Password policy** — min length + Argon2id params (box ke hisaab se tune karna hai).
9. **Session cookie policy** — lifetime, sliding vs absolute expiry (locked: HttpOnly + `Domain=.kumbuild.com`).
10. **Go framework** — stdlib + chi (recommendation) vs gin/echo.
11. **Preview/live hosting** — preview sites kahan host hongi, domain/SSL/deploy kaun karega.
12. **Renewal flow** — reminder kaun bhejega, non-payment pe kya hoga.
13. **Notifications** — WhatsApp manual hi rahega ya automation (WhatsApp Business API)?
14. **Pricing finality** — saari prices DRAFT hain; pricing DB-driven hogi ya docs me rahegi?
15. **GST** — prices inclusive ya exclusive (kahin nahi likha).

## 10. Security — hack aur DDoS se bachav (sab free)

Layers, bahar se andar:

1. **Cloudflare (edge):** unmetered DDoS mitigation, managed WAF, Bot Fight Mode, **1 rate-limiting rule**
   (Free = 1 rule, 10s window) — login endpoint pe lagao (POST /auth/login, 5–10/min per IP, Block).
   Turnstile (free, CAPTCHA puzzle nahi) login/signup/reset forms pe. "Under Attack Mode" panic button hai.
2. **Origin lock (UFW):** sirf Cloudflare ke IP ranges ko 443 pe allow karo + apni IP ko SSH (key-only).
   Warna attacker seedha VPS IP pe attack kar dega.
3. **nginx (VPS pe):** `limit_req` zones — login 10/min, API 10/sec, general 30/sec; connection limits;
   timeouts (Slowloris se bachav); 429 responses.
4. **fail2ban:** sshd jail + nginx-limit-req jail. **Caveat:** Cloudflare ke peeche plain IP ban Cloudflare ko
   ban kar deta hai — `cloudflare-token` action use karo (edge pe block hota hai).
5. **App level:** per-IP + per-account login throttling, Turnstile, HIBP breach check, generic errors,
   password change pe saare sessions invalidate, security headers (HSTS, CSP, X-Content-Type-Options), TLS 1.2+.
6. **VPS hygiene:** SSH key-only, UFW (sirf 22/80/443), security updates auto, secrets sirf env/GitHub Secrets
   me (kabhi code me nahi), nightly `pg_dump` backup off-VPS.

## 11. Deploy

- `.github/workflows/deploy-backend.yml` se Oracle VPS pe deploy (Go binary + systemd service; VPS SSH secrets
  GitHub Secrets me). Workflow + secrets setup backend build ke time pe — VPS connection details secure flow se
  dene honge, chat me kabhi nahi.
- **Domain abhi khareeda nahi hai** — `api.kumbuild.com` + SSO cookie domain ispe depend karte hain.
  Dev `*.pages.dev`/localhost pe chalega; production ko domain chahiye.
- Frontend (Pages) ko API base URL env se milega.

## 12. Build order

| Phase | Kaam |
|---|---|
| **0. Docs theek karo** | `backend/auth`, `backend/orders`, `backend/chat` READMEs rewrite karo (is file se match); PLAN §9 counts theek karo |
| **1. Contract + skeleton** | Go module + REST routes (§5) + `packages/lib` api-client + DB schema/migrations + `User`/`Order`/`Payment` tables; auth middleware (cookie + role check) |
| **2. Auth** | signup/login/logout/me/forgot/reset + seed admin + Argon2id + cookie policy; `?demo_session=` delete karo; account app rewire + `/reset-password` page |
| **3. Orders + customers** | Admin order CRUD + status state machine + customer reads + ownership enforcement; home/admin rewire; loading/error states jodo |
| **4. Payments** | Razorpay payment link ya Order+Checkout (§9 decision), signature verify, webhook; `Payment` me Razorpay fields |
| **5. Admin actions** | Status change, preview publish, revisions, approve, go-live, renewalDate rule, refunds/cancel/hold; audit trail; NewOrderPage 9-field bug fix; Dashboard title fix |
| **6. Renewals + content** | Renewal flow + reminders, content-checklist per order, delivery-clock rule |
| **7. Deploy + wire** | `deploy-backend.yml` se Oracle VPS pe deploy + Pages env + domain khareedne ke baad `api.kumbuild.com` DNS + SSO cookie domain switch |

Full analysis: `~/workspace/shot-tools/kumbuild-audit/BACKEND_BUILD_PLAN.md` (local, repo ke bahar).
