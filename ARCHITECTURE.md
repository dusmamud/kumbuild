# Kumbuild — Architecture

Status: **LOCKED (2026-11-09, user approved) — 2026-11-11 ko 6-app plan se UPDATED.** Ye file code likhne se pehle padhni hai. Jo cheez lock nahi hui, uske saamne DRAFT / TBD likha hai. 2026-11-09 wala "sirf landing + admin, customer account nahi, ek hi Next.js app" plan **superseded** hai — naya plan neeche hai.

## 1. Decisions log

| # | Decision | Status | Kyun |
|---|---|---|---|
| 1 | Monorepo: pnpm workspaces + Turborepo | LOCKED | JS/TS-only, solo builder ke liye simple. Turborepo Vercel maintain karta hai, task running + caching ke liye bana hai. Nx zyada powerful hai (polyglot, distributed CI, release management) par solo ke liye heavy hai. Source: nx.dev |
| 2 | Public site: Astro + React islands | LOCKED | Marketing site mostly static hai. Astro zero JS bhejta hai by default, sirf interactive jagah React island. Exa-verified: same site pe Astro 14 KB JS vs Next.js 82 KB, Lighthouse 99 vs 92, INP 90ms vs 210ms |
| 3 | Apps: 3 alag React+Vite SPAs — `apps/account` (login/signup), `apps/admin` (admin dashboard), `apps/home` (customer dashboard) | LOCKED (2026-11-11, user order — 2026-11-09 wala "ek hi Next.js app" decision superseded) | Har app login ke peeche hai, SEO nahi chahiye, backend non-JS (Go) hoga — isliye Vite SPA sahi hai (Exa-verified 2026-11-11: ASoc, devcerts, WebVerse). Sab static: `vite build` → `dist/` → Cloudflare Pages. Koi SSR, koi server action nahi |
| 4 | Admin apni alag app hai (`apps/admin`) | LOCKED (2026-11-11 — 2026-11-09 wala "Admin alag app NAHI" decision superseded) | Admin dashboard Next.js app se Vite me port kiya gaya hai. Purana Next.js app (`apps/app`, kumbuild-app.pages.dev) LEGACY hai — abhi live hai, par naye features nahi banenge; Vite admin live hote hi use hata diya jayega |
| 4a | Customer accounts hain (2026-11-11) | LOCKED (user order — 2026-11-09 wala "customer ka koi account nahi" lock superseded) | Customer account.kumbuild.com pe signup/login karta hai; apne orders home.kumbuild.com pe track karta hai. `auth.kumbuild.com` khatam — ab `account.kumbuild.com` hai (central login/signup, dono roles) |
| 5 | Deploy: GitHub Actions → Cloudflare | LOCKED | Vercel plan hata diya. Creestion / dusrel wala flow pehle se verified hai |
| 6 | Backend baad me (Go, planned), frontend pehle (mock) | LOCKED | Frontend mock data + api-client se complete hoga. Backend aane pe sirf base URL badlega (`api.kumbuild.com`) |
| 6a | Auth flow: central login + role redirect + mock handoff | LOCKED (2026-11-11) | Login/signup sirf `apps/account` me. Success pe role redirect: admin → admin.kumbuild.com, customer → home.kumbuild.com. **Mock phase:** session localStorage (`kb_session`), cross-app handoff `?demo_session=` (base64, 5-min expiry, DEMO ONLY — kabhi production auth nahi). **Production (Go backend):** HttpOnly session cookie `Domain=.kumbuild.com` = SSO; Go har API call pe auth/roles enforce karega |
| 7 | Language: TypeScript everywhere | LOCKED | Chaaro apps + packages me ek hi language, shared types |
| 8 | Styling: Tailwind CSS | LOCKED | Sab apps me ek hi design system (theme tokens) |
| 9 | Design tokens — colors | LOCKED (THEME.md, 2026-11-09) | Option A Trust Blue, primary logo wala #008EFD (scale 50–900). Orange #C2410C sirf order/submit buttons pe (2026-11-11). Font: Sora headings + Inter body (docs-site port, live 2026-11-10). **Sab apps sirf light — koi dark mode nahi** (user ko dark pasand nahi, 2026-11-10). ShrinkIt ke tokens yahan automatically apply nahi honge — alag brand hai |

## 2. Monorepo tree

```
kumbuild/                      <- workspace root (ye folder; future GitHub repo ka bhi yahi shape hoga)
  README.md / ABOUT.md / PLAN.md / ARCHITECTURE.md / SUBDOMAINS.md / DEPLOYMENT.md
  frontend/                    <- frontend monorepo
    apps/
      web/                     <- kumbuild.com — Astro + React
      account/                 <- account.kumbuild.com — login/signup — React + Vite (SPA, static)
      admin/                   <- admin.kumbuild.com — admin dashboard — React + Vite (SPA, static)
      home/                    <- home.kumbuild.com — customer dashboard — React + Vite (SPA, static)
      app/                     <- LEGACY Next.js app (auth + admin, STATIC export) — abhi live, naye features nahi
    packages/
      ui/                      <- shared components + Tailwind tokens (abhi khaali hai)
      config/                  <- shared tsconfig / eslint / tailwind + theme tokens
      lib/                     <- shared types + i18n dicts + mock data + mock auth + api-client
  backend/                     <- backend (baad me, Go — api.kumbuild.com)
    auth/ orders/ payments/ chat/ websites/ shared/
```

## 3. Tech stack

| Layer | Choice | Note |
|---|---|---|
| Package manager | pnpm workspaces | Monorepo ke liye, fast + disk space bachata hai |
| Task runner | Turborepo | `turbo.json` se build / lint / test tasks, caching |
| Language | TypeScript (strict) | Har app + package me |
| Public site | Astro + React islands | Static pages, `client:*` sirf jahan interaction chahiye |
| Blog + Docs | Astro 7 (+ Starlight for docs) | `apps/blog` (blog.kumbuild.com), `apps/docs` (docs.kumbuild.com) — user ne banaye (2026-11-11); static content sites |
| Apps (account/admin/home) | React 19 + Vite 6 + React Router + TanStack Query | Login ke peeche SPAs — koi SEO nahi, koi SSR nahi; sirf static `dist/` |
| Legacy app | Next.js App Router + React 19 (STATIC export) | Sirf `apps/app` — abhi live, naye features nahi; Vite admin se replace hoga |
| Styling | Tailwind CSS v4 | Shared tokens — Vite apps landing wali `theme.css` tokens share karte hain |
| Deploy (web) | Cloudflare Pages via GitHub Actions | `wrangler pages deploy dist` |
| Deploy (account/admin/home) | Cloudflare Pages via GitHub Actions (static) | `vite build` → `dist/` → `wrangler pages deploy dist --project-name=kumbuild-account|admin|home` — koi Worker nahi |
| Deploy (blog/docs) | Cloudflare Pages via GitHub Actions (static) | `astro build` → `dist/` → `wrangler pages deploy dist --project-name=kumbuild-blog|docs` — koi Worker nahi |
| Deploy (legacy app) | Cloudflare Pages via GitHub Actions (static export) | `next build` (`output: "export"`) → `wrangler pages deploy out` — koi Worker/OpenNext nahi |
| Backend | Go (planned) — `api.kumbuild.com` | Frontend phase me mock data |

Version note: Astro 5 (web), Astro 7.4.10 (blog/docs), React 19, Vite 6, Tailwind v4 — ye versions build me use hui hain (2026-11-11).

## 4. Frontend — apps/web (kumbuild.com)

- **Framework:** Astro + React islands
- **Pages:** `/`, `/pricing`, `/services`, `/examples`, `/how-it-works`, `/order`, `/faq`, `/about`, `/contact`, `/privacy`, `/terms`
- **Kaam:** sirf public content + order form. Yahan login nahi hai, dashboard nahi hai.
- **Performance:** Astro by default zero JS bhejta hai. Isliye marketing pages fast aur SEO-friendly hote hain — yehi reason hai Astro chunne ka.
- **Shared use:** `packages/ui` se components, `packages/lib` se types (jaise package list, order form fields)

## 4b. Frontend — apps/blog, apps/docs (Astro, STATIC)

User ne banaye (2026-11-11) — dono static content sites hain, login nahi hai:

- **apps/blog — blog.kumbuild.com:** Astro 7.4.10 + Tailwind 4.3.5. Blog posts (MDX/content collections), Pagefind search (Cmd+K), RSS, sitemap. Dev port 4322.
- **apps/docs — docs.kumbuild.com:** Astro 7.4.10 + Starlight 0.42.10 + Tailwind 4.3.5. Help docs (getting started, payments/renewal, preview/revisions, FAQ). Dev port 4323.
- **Deploy:** `astro build` → `dist/` → Cloudflare Pages (projects `kumbuild-blog` / `kumbuild-docs`, workflows `deploy-blog` / `deploy-docs`).

## 5. Frontend — apps/account, apps/admin, apps/home (React+Vite SPAs, STATIC)

Teeno apps ek hi stack pe hain: **React 19 + Vite 6 + React Router + TanStack Query + Tailwind v4**. Har app apna alag Cloudflare Pages project hai. **Koi server nahi hai: no SSR, no server actions, no API routes.** Sab kuch static files hain; data mock phase me `packages/lib` se aata hai, backend aane pe `api.kumbuild.com` se aayega.

- **apps/account — account.kumbuild.com:** central login/signup. Pages: `/login`, `/signup`, `/forgot-password`. Login success pe role redirect: admin → admin.kumbuild.com, customer → home.kumbuild.com.
- **apps/admin — admin.kumbuild.com:** admin dashboard (Next.js app ka Vite port). Pages: `/` (dashboard), `/orders`, `/orders/new`, `/orders/:id`, `/customers`, `/builds`, `/payments`, `/settings`. Guard: `RequireRole role="admin"` — bina admin session ke account login pe redirect.
- **apps/home — home.kumbuild.com:** customer dashboard. Pages: `/` (my orders), `/orders/:id` (status stepper + payments + preview/live links), `/profile`. Customer sirf apne orders dekhta hai (`getCustomerOrders(session.email)`). Guard: `RequireRole role="customer"`.
- **Locale routing (Vite apps):** en-US bina prefix, hi → `/hi/`, bn → `/bn/` (landing jaisa). Locale URL prefix se padha jata hai; router `basename` se kaam karta hai. **Note:** 3 Vite apps abhi English-only hain — locale plumbing (`LocaleProvider` + `LocaleSwitcher`, shared dicts) scaffolded hai, page strings English me hain; app pages ki full i18n baad me hogi.
- **Dev ports:** account 5173, admin 5174, home 5175 (preview 4173/4174/4175).

### Auth flow (frontend phase — mock, CLIENT SIDE)

```
kumbuild.com Login/Signup -> account.kumbuild.com/login
  login success (admin)    -> admin.kumbuild.com  (?demo_session= handoff)
  login success (customer) -> home.kumbuild.com   (?demo_session= handoff)
```

Session frontend phase me mock hai — localStorage (`kb_session`). Mock users: `admin@kumbuild.com` (admin, Dus Mamud) aur mock customers (jaise `customer@example.com` — Ramesh Sharma); koi bhi password 6+ characters ka chalta hai. Signup naya mock customer banata hai (localStorage `kb_users`).

**Cross-app handoff (DEMO ONLY):** localStorage per-origin hota hai, isliye account app session ko `?demo_session=` (base64, 5-min expiry) se role app tak pahunchati hai; receiving app use localStorage me likh ke URL se hata deti hai. **Ye handoff kabhi production auth nahi banega** — production me Go backend ka HttpOnly cookie (`Domain=.kumbuild.com`) aayega, jo teeno subdomains pe SSO dega. **Frontend guard sirf UX hai, security nahi** — asli session/role check Go backend har API call pe karega. Ye baat bhoolna nahi hai. **Redirect targets (`src/lib/urls.ts`):** custom domain khareeda nahi hai, isliye jab app `*.pages.dev` pe chal rahi ho to redirect sibling `*.pages.dev` URLs pe jata hai (account → `kumbuild-admin.pages.dev` / `kumbuild-home.pages.dev`); custom domain lagne ke baad hostname `*.pages.dev` nahi hoga aur subdomain URLs (`admin.kumbuild.com` etc.) lagenge; local dev me `.env.development` (localhost ports) jeet ta hai.

### LEGACY — apps/app (Next.js, STATIC export)

Purana admin app — **ek hi Next.js App Router app, do subdomains (auth login + admin dashboard), sirf static export** (`output: "export"`, Cloudflare Pages project `kumbuild-app`, live: https://kumbuild-app.pages.dev). 2026-11-11 ko Vite admin app ne iski jagah le li hai. **Naye features isme nahi banenge.** Vite admin live hote hi is app ko hata diya jayega (aur `kumbuild-app` Pages project delete kar diya jayega). Iska routing detail (route groups `(auth)`/`(admin)`, `[locale]` tree, next-intl static-export gotchas) git history me hai — naye code me use mat karo.

Is app me customer ka kuch nahi tha — na signup, na customer dashboard, na customer login. Sirf `admin@kumbuild.com` login kar sakta tha, password padha hi nahi jata tha.

## 6. Shared packages

### packages/ui

Shared components + Tailwind tokens. **Abhi khaali hai** — teeno Vite apps apne components khud rakhte hain (landing wali `theme.css` tokens share karte hain). Jab common components banenge, yehi use honge, taaki kumbuild.com aur dashboards ek jaise dikhein.

### packages/config

Shared tsconfig, eslint, tailwind config. Har app apni config yahin se extend karega, taaki rules har jagah same rahein.

### packages/lib

- Shared types: `Package`, `Order`, `Customer`, `Website` — frontend aur (baad me) backend dono ke liye ek hi shape
- Mock data (`mock.ts`): orders, customers, payments — frontend phase me isi se admin + home dashboards chalte hain (`getOrder`, `getCustomerOrders`, `getCustomerByEmail`)
- Mock auth (`mock-auth.ts`): `login` / `signup` / `logout` / `getSession` + DEMO ONLY `?demo_session=` handoff (`encodeDemoSession` / `acceptDemoSession`)
- i18n dicts (`i18n/`): `en-US.json`, `hi.json`, `bn.json` — shared dictionaries, sab apps wahi use karte hain
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
| `auth/` | **Customer + admin login/signup, session, roles, password reset** (Go backend, `api.kumbuild.com`) — mock phase me ye kaam `packages/lib/mock-auth.ts` + `apps/account` karte hain |
| `orders/` | Order create (website form / admin khud add karega), status (received → in progress → preview → delivered), revisions |
| `payments/` | Advance 50% + final 50%, yearly renewal, payment history (provider: Razorpay) |
| `chat/` | In-app chat nahi hoga — customer se baat WhatsApp / Instagram DM pe hogi |
| `websites/` | Delivered websites ka record — stage, domain, hosting, renewal date |
| `shared/` | Shared types, utils, DB access |

Backend ka stack: **Go (planned) — API `api.kumbuild.com` pe hogi.** Database aur hosting abhi decide nahi hue — TBD. Frontend complete hone ke baad decide hoga.

## 9. Security principles

1. **Frontend guard ≠ security.** Login check aur role check UI me sirf user ko sahi jagah bhejne ke liye hai. Data ki raksha backend karega.
2. **Admin data sirf admin role ko; customer data sirf us customer ko.** Har API call pe backend role check karega — frontend alag app ho ya ek app, isse koi farq nahi padta.
3. **Secrets kabhi code me nahi.** Cloudflare token, API keys — sirf GitHub Secrets / Cloudflare dashboard me. User khud add karega.
4. **Customer apna data khud dekhta hai.** Customer home.kumbuild.com pe sirf apne orders, apni payments aur apni profile dekhta hai — doosre customer ka kuch nahi. Admin sab kuch dekhta hai. Ye separation backend ke role check se aayegi; mock phase me `getCustomerOrders(session.email)` se filter hota hai.

## 10. Split — ho gaya (2026-11-11)

Admin aur customer apps pehle se hi alag hain: `apps/admin` (admin dashboard) aur `apps/home` (customer dashboard) — dono alag Vite SPAs, alag Pages projects. 2026-11-09 wala "future me split karenge" plan poora ho gaya; is section ka purana trigger list (team alag ho, heavy tools aayein, deploy cycle alag ho) ab irrelevant hai. Central login `apps/account` me hai; teeno apps `packages/ui` aur `packages/lib` share karte hain.

## 11. Kya is doc me nahi hai (TBD)

- Backend stack — Go planned hai; database + hosting decide nahi hue
- Payment provider — Razorpay (LOCKED 2026-11-09)
- Database — decide nahi hua
- 3 Vite apps ki full i18n (app pages abhi English-only hain)
