# Kumbuild — Tell us what to build.

Done-for-you website service for small businesses. Customer batayega kya chahiye, Kumbuild website bana ke dega.

- **Brand:** Kumbuild
- **Tagline:** Tell us what to build.
- **Website:** kumbuild.com — landing + pricing + order (Astro, **LIVE** — https://kumbuild-web.pages.dev)
- **Auth:** account.kumbuild.com — central login/signup, dono roles ke liye (React+Vite)
- **Admin dashboard:** admin.kumbuild.com — sirf admin ke liye (React+Vite)
- **Customer dashboard:** home.kumbuild.com — customer apne orders track karega (React+Vite)
- **Blog:** blog.kumbuild.com — blog posts (Astro 7, user ne banaya 2026-11-11)
- **Docs:** docs.kumbuild.com — help docs (Astro 7 + Starlight, user ne banaya 2026-11-11)
- **Status (2026-11-11):** Landing live hai; account + admin + home — teeno Vite apps build ho gaye hain (mock data, static). **Plan 2026-11-11 ko badla:** pehle sirf landing + admin tha, customer account nahi tha — ab 6 apps hain (neeche dekho). Pricing draft hai, final nahi hui. Backend (Go) baad me banega.

## Ye folder kya hai?

Ye Kumbuild ka workspace root hai: `~/workspace/kumbuild/`

```
kumbuild/                  <- ye root. Saare docs (.md / .pdf) yahin rahenge.
  README.md                <- ye file — shuruaat yahin se karo
  ABOUT.md                 <- Kumbuild kya hai, kya karta hai, target audience
  PLAN.md                  <- service plan: problem, packages (draft), order flow, launch
  PRICING.md / SERVICES.md / DELIVERY.md / CONTENT.md / FAQ.md
  PRIVACY.md / TERMS.md / REFUND.md   <- legal docs (DRAFT)
  STACK.md                 <- tech stack summary
  THEME.md                 <- theme + colors (Option A Trust Blue, LOCKED) + locales (en-US/hi/bn)
  ARCHITECTURE.md          <- monorepo + tech stack (2026-11-11: 6-app plan — web/account/admin/home/blog/docs)
  SUBDOMAINS.md            <- kumbuild.com / account / admin / home / blog / docs — har page
  DEPLOYMENT.md            <- GitHub Actions -> Cloudflare Pages (6 projects)
  frontend/                <- frontend monorepo (Astro + React+Vite)
    apps/web/              <- kumbuild.com
    apps/account/          <- account.kumbuild.com — central login/signup (React+Vite)
    apps/admin/            <- admin.kumbuild.com — admin dashboard (React+Vite)
    apps/home/             <- home.kumbuild.com — customer dashboard (React+Vite)
    apps/blog/             <- blog.kumbuild.com — blog (Astro 7, user ne banaya)
    apps/docs/             <- docs.kumbuild.com — help docs (Astro 7 + Starlight, user ne banaya)
    apps/app/              <- LEGACY Next.js app (auth + admin) — abhi live hai, naye features nahi
    packages/ui/           <- shared components (abhi khaali hai)
    packages/config/       <- shared config (theme tokens)
    packages/lib/          <- shared types + i18n dicts + mock data + mock auth + api-client
  backend/                 <- backend (baad me, Go — abhi sirf folders + README)
```

## Docs — kaunsi file kab padhni hai

| File | Kya hai | Kiske liye |
|---|---|---|
| `ABOUT.md` | Kumbuild kya hai, kya karta hai, kiske liye hai / nahi hai | Kisi ko bhi service samjhani ho to pehle ye |
| `PLAN.md` | Poora business plan — problem, customer, services, packages (draft), order flow, delivery, revenue, launch, risks | Pricing / launch decide karte time |
| `PRICING.md` | Packages, comparison, renewal, payment terms (draft) | Price batana ya final karna ho to |
| `PAYMENTS.md` | Razorpay — methods, fees (2% + GST), settlement, integration, secrets, refunds | Payment ka sawaal aaye to |
| `SERVICES.md` | 4 services ki detail — kya milega, kya nahi milega | Service samjhani ho to |
| `DELIVERY.md` | Delivery time, stages, revision policy, approval, go-live (draft) | Delivery ki policy dekhni ho to |
| `CONTENT.md` | Customer ko kya dena hoga — details, photos, logo | Order form banate time |
| `FAQ.md` | Aam sawaal-jawab — `/faq` page ka base (draft) | FAQ page banate time |
| `PRIVACY.md` | Privacy policy (DRAFT — legal advice nahi) | Website pe publish karne se pehle |
| `TERMS.md` | Terms and conditions (DRAFT — legal advice nahi) | Website pe publish karne se pehle |
| `REFUND.md` | Refund policy (DRAFT — final nahi hui) | Refund ka sawaal aaye to |
| `STACK.md` | Tech stack ka ek jagah summary | Stack batana ho to |
| `THEME.md` | Theme + color grading (Option A Trust Blue, LOCKED) + locales en-US/hi/bn — sab apps light-only, Vite apps ko dark mode nahi | Colour, theme ya language ka sawaal aaye to |
| `ARCHITECTURE.md` | Monorepo, tech stack, frontend + backend structure, auth flow, security | Code likhne se pehle |
| `SUBDOMAINS.md` | Har subdomain pe kaunse pages, kaun khol sakta hai, redirects, DNS | Pages ya routing banate time |
| `DEPLOYMENT.md` | GitHub Actions → Cloudflare Pages (6 projects), secrets, domains, limits | Deploy karte time |
| `frontend/README.md` | Frontend monorepo ka overview | Frontend kaam shuru karte time |
| `backend/README.md` | Backend services ka overview (baad me) | Backend kaam shuru karte time |

## Locked decisions (2026-11-09, user approved — 2026-11-11 ko 6-app plan se updated)

| Decision | Kya lock hua |
|---|---|
| Brand / tagline | Kumbuild — Tell us what to build. |
| Service | Done-for-you websites, small business ke liye |
| Monorepo | pnpm workspaces + Turborepo |
| Public site | Astro + React islands (`apps/web`) |
| Apps | **6 frontend apps:** `apps/web` (Astro, kumbuild.com), `apps/account` (React+Vite, account.kumbuild.com — login/signup), `apps/admin` (React+Vite, admin.kumbuild.com — admin dashboard), `apps/home` (React+Vite, home.kumbuild.com — customer dashboard), `apps/blog` (Astro 7, blog.kumbuild.com — blog, user ne banaya 2026-11-11), `apps/docs` (Astro 7 + Starlight, docs.kumbuild.com — help docs, user ne banaya 2026-11-11) |
| Admin | **Apni alag Vite app hai** (`apps/admin`) — 2026-11-09 wala "admin alag app NAHI, ek hi Next.js app" decision **superseded** hai (2026-11-11). Purana Next.js app (`apps/app`, kumbuild-app.pages.dev) LEGACY hai — abhi live hai, par naye features nahi banenge |
| Customer accounts | **Hain** (2026-11-11): customer account.kumbuild.com pe signup/login karta hai, apne orders home.kumbuild.com pe track karta hai. 2026-11-09 wala "customer ka koi account nahi" decision **superseded** hai |
| Deploy | Frontend GitHub Actions se Cloudflare Pages pe (Vercel plan hata diya) — 6 Pages projects: kumbuild-web, kumbuild-account, kumbuild-admin, kumbuild-home, kumbuild-blog, kumbuild-docs |
| Payment provider | Razorpay (LOCKED 2026-11-09) — UPI, cards, netbanking, wallets; 2% + 18% GST on fee |
| Theme | Option A Trust Blue (LOCKED 2026-11-09) — primary #008EFD (logo wala); **sab apps sirf light** (dark mode nahi — user ko dark pasand nahi); orange #C2410C sirf order buttons pe |
| Locales | en-US (default, no URL prefix), hi (`/hi/`), bn (`/bn/`) — shared dictionaries `packages/lib/src/i18n/` (LOCKED 2026-11-09). **Note:** 3 Vite apps abhi English-only hain (locale plumbing scaffolded hai, page strings English me) — app pages ki full i18n baad me hogi |
| Backend | Baad me — Go (planned, `api.kumbuild.com`); pehle frontend mock data se complete hoga |
| Code | Landing live hai; account/admin/home Vite apps build ho gaye hain (mock phase) |

## Draft / TBD — ye final mat samjho

- **Pricing draft hai:** Starter ₹3,999, Business ₹7,999, Premium ₹14,999, renewal ₹1,999/saal. Final nahi hui.
- **Delivery 3–5 din draft hai.**
- **`kumbuild.com` domain abhi nahi khareeda** (user ne 2026-11-09 ko confirm kiya) — availability + price user ko registrar (Cloudflare/Namecheap/GoDaddy) pe khud check karna hai. Khareedne ke baad custom domains + wildcard DNS lagenge.
- **`auth.kumbuild.com` khatam hai — ab `account.kumbuild.com` hai** (central login/signup, 2026-11-11). `auth.kumbuilds.com` (s wala) typo tha, ab irrelevant hai.
- **Repo: `dusmamud/kumbuild`, public** (2026-11-09; production pe private karna hai — user khud karega).

## Kaam ka order

1. Plan + pricing final karo (`PLAN.md` ke open decisions)
2. `frontend/apps/web` — kumbuild.com landing + order form — **DONE + LIVE**
3. `frontend/apps/account` + `apps/admin` + `apps/home` — login/signup + admin + customer dashboard (mock data) — **DONE (build), deploy next push pe**
4. 3 demo sites — shop, clinic, tuition (portfolio)
5. Launch (domain khareedne ke baad custom domains)
6. Backend — Go (`api.kumbuild.com`): auth, orders, payments, chat (frontend ke baad)

## Sources — cross-verification

Tech claims Exa se verify kiye gaye hain (2026-11-09):

- Astro vs Next.js marketing site: same site pe Astro ne 14 KB JS bheja, Next.js ne 82 KB; Lighthouse 99 vs 92; INP 90ms vs 210ms. Source: ssg-production.com, 2026-06-18.
- Turborepo: JS/TS-only monorepo task runner, Vercel maintain karta hai. Nx zyada powerful hai par polyglot / distributed CI ke liye hai — solo builder ke liye heavy hai. Source: nx.dev docs.
- Subdomain routing: `account` + `admin` + `home` + `blog` + `docs` — **har ek apna alag Cloudflare Pages project hai** (account/admin/home = React+Vite static SPAs, 2026-11-11; blog/docs = Astro 7 static, user ne banaye 2026-11-11). Purana plan (auth + admin dono ek hi `kumbuild-app` Next.js project pe) superseded hai. (Static export + next-intl, Exa-verified 2026-11-09 — ye sirf legacy `apps/app` pe lagu tha.)
- Next.js on Cloudflare: app **sirf static** host hoti hai — `output: "export"` → `wrangler pages deploy out`. Koi Worker/OpenNext nahi (user decision 2026-11-09). **Ye sirf legacy `apps/app` pe lagu hai** — naye Vite apps `vite build` → `dist/` deploy karte hain.
- Creestion deploy pattern: GitHub Actions → `wrangler pages deploy dist` — Dus ke dusrel / creestion projects me pehle se verified hai.

Business claims (problem, customer, pricing) user ke apne words aur decisions se hain — koi market statistic invent nahi ki gayi hai.
