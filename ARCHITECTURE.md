# Kumbuild — Architecture

Status: **LOCKED (2026-11-09, user approved).** Ye file code likhne se pehle padhni hai. Jo cheez lock nahi hui, uske saamne DRAFT / TBD likha hai.

## 1. Decisions log

| # | Decision | Status | Kyun |
|---|---|---|---|
| 1 | Monorepo: pnpm workspaces + Turborepo | LOCKED | JS/TS-only, solo builder ke liye simple. Turborepo Vercel maintain karta hai, task running + caching ke liye bana hai. Nx zyada powerful hai (polyglot, distributed CI, release management) par solo ke liye heavy hai. Source: nx.dev |
| 2 | Public site: Astro + React islands | LOCKED | Marketing site mostly static hai. Astro zero JS bhejta hai by default, sirf interactive jagah React island. Exa-verified: same site pe Astro 14 KB JS vs Next.js 82 KB, Lighthouse 99 vs 92, INP 90ms vs 210ms |
| 3 | App: ek hi Next.js App Router app (auth + admin) | LOCKED | Do alag apps me do deploy, do baar auth ki dikkat hoti. Ek app me ek login session, ek design system, ek deploy. **STATIC export** (2026-11-09, user decision) — Cloudflare Pages, koi Worker nahi |
| 4 | Admin alag app NAHI | LOCKED (user ne samajh ke approve kiya) | Admin sirf ek aadmi use karega. Alag app se security nahi milti — asli security backend ke role check se milti hai. Code me `(admin)` route group alag hai, role guard se protected. Future me team/scale badhe to split possible |
| 5 | Deploy: GitHub Actions → Cloudflare | LOCKED | Vercel plan hata diya. Creestion / dusrel wala flow pehle se verified hai |
| 6 | Backend baad me, frontend pehle (mock) | LOCKED | Frontend mock data + api-client se complete hoga. Backend aane pe sirf base URL badlega |
| 7 | Language: TypeScript everywhere | LOCKED | Dono apps + packages me ek hi language, shared types |
| 8 | Styling: Tailwind CSS | LOCKED | Dono apps me ek hi design system (`packages/ui`) |
| 9 | Design tokens — colors | LOCKED (THEME.md, 2026-11-09) | Option A Trust Blue, primary logo wala #008EFD (scale 50–900). Font abhi final nahi — Inter/system stack (Latin) + Noto Sans Devanagari/Bengali, final font build ke time lock hoga. ShrinkIt ke tokens yahan automatically apply nahi honge — alag brand hai |

## 2. Monorepo tree

```
kumbuild/                      <- workspace root (ye folder; future GitHub repo ka bhi yahi shape hoga)
  README.md / ABOUT.md / PLAN.md / ARCHITECTURE.md / SUBDOMAINS.md / DEPLOYMENT.md
  frontend/                    <- frontend monorepo
    apps/
      web/                     <- kumbuild.com — Astro + React
      app/                     <- auth + admin — Next.js App Router (STATIC export)
    packages/
      ui/                      <- shared components + Tailwind tokens
      config/                  <- shared tsconfig / eslint / tailwind
      lib/                     <- shared types + mock data + api-client
  backend/                     <- backend (baad me)
    auth/ orders/ payments/ chat/ websites/ shared/
```

## 3. Tech stack

| Layer | Choice | Note |
|---|---|---|
| Package manager | pnpm workspaces | Monorepo ke liye, fast + disk space bachata hai |
| Task runner | Turborepo | `turbo.json` se build / lint / test tasks, caching |
| Language | TypeScript (strict) | Har app + package me |
| Public site | Astro + React islands | Static pages, `client:*` sirf jahan interaction chahiye |
| App | Next.js App Router + React 19 | Admin dashboard, admin login — interactive app |
| Styling | Tailwind CSS | Shared tokens `packages/ui` me |
| Deploy (web) | Cloudflare Pages via GitHub Actions | `wrangler pages deploy dist` |
| Deploy (app) | Cloudflare Pages via GitHub Actions (static export) | `next build` (`output: "export"`) → `wrangler pages deploy out` — koi Worker/OpenNext nahi |
| Backend | TBD (baad me) | Frontend phase me mock data |

Version note: exact versions (Astro 5, Next.js 15/16 era) build ke time latest stable se leni hain. Is doc me koi version pin nahi kiya gaya hai, taaki likhte time galat version lock na ho.

## 4. Frontend — apps/web (kumbuild.com)

- **Framework:** Astro + React islands
- **Pages:** `/`, `/pricing`, `/services`, `/examples`, `/how-it-works`, `/order`, `/faq`, `/about`, `/contact`, `/privacy`, `/terms`
- **Kaam:** sirf public content + order form. Yahan login nahi hai, dashboard nahi hai.
- **Performance:** Astro by default zero JS bhejta hai. Isliye marketing pages fast aur SEO-friendly hote hain — yehi reason hai Astro chunne ka.
- **Shared use:** `packages/ui` se components, `packages/lib` se types (jaise package list, order form fields)

## 5. Frontend — apps/app (admin only, STATIC)

Ek hi Next.js app, do subdomains (admin login + admin dashboard) — **sirf static export** (user decision 2026-11-09: "Next.js ka sirf static Cloudflare Pages me host karna hai, not Workers"). Pehle OpenNext/Worker ka plan tha — superseded. **Koi server nahi hai: no proxy/middleware, no server actions, no SSR.** Customer ka is app me kuch nahi hai — na signup, na customer dashboard, na customer login.

```
apps/app/
  next.config.ts               <- output: "export" (static)
  public/_redirects            <- /en-US/* -> /:splat 301
  app/
    layout.tsx                 <- root layout: en-US (default locale, bina prefix)
    (auth)/                    <- /login, /forgot-password (sirf admin login)
    (admin)/                   <- /, /orders, /orders/new, /customers, /builds, /payments, /settings
    [locale]/                  <- hi/bn ke liye nested provider + wahi (auth)/(admin) routes
      layout.tsx               <- sirf hi/bn (generateStaticParams: default locale nahi)
  lib/
    auth.ts                    <- session (frontend phase: mock, localStorage)
    api.ts                     <- packages/lib ke api-client ka use
  components/
    RequireAdmin.tsx           <- client-side guard: bina session ke /login
```

### Route groups ka matlab

`(auth)`, `(admin)` — ye brackets wale folders URL me nahi aate. Ye sirf code ko alag rakhne ke liye hain: alag layout, alag menu, alag guard.

### Locale routing — static export (Exa-verified, next-intl docs)

Static export me middleware nahi chalta, isliye `localePrefix: "as-needed"` ke liye middleware wala tareeka kaam nahi karta. Structure is hisaab se hai:

- **Default locale (en-US) root par hai** — `/login`, `/orders` (koi `/en-US` prefix nahi). `out/` me `/en-US/...` files banti hi nahi.
- **hi/bn `[locale]/` tree me hain** — `/hi/login`, `/bn/orders`. Root layout en-US provider deta hai, `[locale]` layout ka nested provider use override karta hai.
- **next-intl server APIs bina locale ke NAHI chalti** — `getMessages({ locale })`, `getTranslations({ locale, namespace })` jaise seedha locale pass karo, warna `headers()` fallback build fail kar deta hai. `setRequestLocale` ka cache pages tak nahi pahunchta.
- **next-intl ka `Link` server component me mat use karo** — woh `getServerLocale()` se `headers()` padhta hai. Link wale components client hone chahiye. `LocaleSwitcher` plain `next/link` + khud ka href banata hai (locale prop force-prefix karta hai — static export me `/en-US/...` 404 hota).

### Auth flow (frontend phase — mock, CLIENT SIDE)

```
Bina login:
  admin.kumbuild.com/* -> /login (RequireAdmin client-side redirect)

Login success (admin):
  session localStorage me (key "kb_session") -> /
```

Session frontend phase me mock hai — sirf `admin@kumbuild.com` login kar sakta hai, password padha hi nahi jata. Asli session backend aane pe banegi. **Frontend guard sirf UX hai, security nahi** — asli security backend ke API role check se aayegi. Ye baat bhoolna nahi hai.

## 6. Shared packages

### packages/ui

Shared components + Tailwind tokens. Dono apps yahi use karenge, taaki kumbuild.com aur dashboard ek jaise dikhein. Button, input, card, layout, header — ek baar banao, do jagah use karo.

### packages/config

Shared tsconfig, eslint, tailwind config. Har app apni config yahin se extend karega, taaki rules har jagah same rahein.

### packages/lib

- Shared types: `Package`, `Order`, `Customer`, `Website` — frontend aur (baad me) backend dono ke liye ek hi shape
- Mock data: orders, customers, websites — frontend phase me isi se dashboard chalega
- `api-client`: fetch wrapper. Abhi ye mock data deta hai. Backend aane pe sirf iska base URL badlega, ek bhi page dobara nahi banana padega.

## 7. Data flow

```
Frontend phase (abhi):
  Page -> packages/lib api-client -> mock data (packages/lib me)

Backend phase (baad me):
  Page -> packages/lib api-client -> backend API (backend/ services)
  UI me koi change nahi — sirf api-client ka base URL badlega
```

## 8. Backend — backend/ (baad me)

| Service | Zimmedari |
|---|---|
| `auth/` | Admin login, session, admin role, password reset |
| `orders/` | Order create (admin khud add karega), status (received → in progress → preview → delivered), revisions |
| `payments/` | Advance 50% + final 50%, yearly renewal, payment history (provider: Razorpay) |
| `chat/` | In-app chat nahi hoga — customer se baat WhatsApp / Instagram DM pe hogi |
| `websites/` | Delivered websites ka record — stage, domain, hosting, renewal date |
| `shared/` | Shared types, utils, DB access |

Backend ka stack (language, framework, database, hosting) abhi decide nahi hua — TBD. Frontend complete hone ke baad decide hoga. Isliye is doc me backend stack ke baare me kuch claim nahi kiya gaya hai.

## 9. Security principles

1. **Frontend guard ≠ security.** Login check aur role check UI me sirf user ko sahi jagah bhejne ke liye hai. Data ki raksha backend karega.
2. **Admin data sirf admin role ko.** Har admin API call pe backend role check karega — frontend alag app ho ya ek app, isse koi farq nahi padta.
3. **Secrets kabhi code me nahi.** Cloudflare token, API keys — sirf GitHub Secrets / Cloudflare dashboard me. User khud add karega.
4. **Customer ka data sirf admin ko.** Customer ka koi login nahi hai, isliye customer-facing data exposure ka sawaal hi nahi hai — orders, payments aur websites sirf admin dashboard me dikhenge.

## 10. Future split — admin ko kab alag karna hai

Abhi nahi. Tab karna jab inme se koi ek sach ho:

- Admin use karne wali team alag ho jaye (sirf Dus nahi)
- Admin me bahut heavy internal tools aa jayein jo customer app se bilkul alag hon
- Admin ka deploy cycle customer app se alag chahiye ho

Split ka tareeka pehle se tay hai: `(admin)` route group ko utha ke `apps/admin` me daal dena hai. `packages/ui` aur `packages/lib` wahi rahenge, dobara nahi banenge.

## 11. Kya is doc me nahi hai (TBD)

- Kumbuild ke design tokens: colors lock hain (THEME.md — Option A Trust Blue); font final nahi — build ke time lock hoga
- Backend stack — decide nahi hua
- Payment provider — Razorpay (LOCKED 2026-11-09)
- Database — decide nahi hua
- Exact framework versions — build ke time latest stable
