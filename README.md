# Kumbuild — Tell us what to build.

Done-for-you website service for small businesses. Customer batayega kya chahiye, Kumbuild website bana ke dega.

- **Brand:** Kumbuild
- **Tagline:** Tell us what to build.
- **Website (plan):** kumbuild.com — landing + pricing + order
- **Admin dashboard (plan):** admin.kumbuild.com — sirf admin ke liye
- **Auth (plan):** auth.kumbuild.com — admin login (sirf Dus)
- **Status (2026-11-09):** Plan stage hai. Kuch build nahi hua, koi code nahi likha gaya. Architecture, subdomains aur deployment locked hain. Pricing draft hai, final nahi hui.

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
  ARCHITECTURE.md          <- monorepo + tech stack (locked)
  SUBDOMAINS.md            <- kumbuild.com / auth / admin — har page
  DEPLOYMENT.md            <- GitHub Actions -> Cloudflare Pages
  frontend/                <- frontend monorepo (Astro + Next.js)
    apps/web/              <- kumbuild.com
    apps/app/              <- auth (admin login) + admin (ek hi Next.js app)
    packages/ui/           <- shared components
    packages/config/       <- shared config
    packages/lib/          <- shared types + mock data + api-client
  backend/                 <- backend (baad me — abhi sirf folders + README)
    auth/ orders/ payments/ chat/ websites/ shared/
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
| `THEME.md` | Theme + color grading (Option A Trust Blue, LOCKED) + locales en-US/hi/bn — Astro light-only, Next.js system/light/dark | Colour, theme ya language ka sawaal aaye to |
| `ARCHITECTURE.md` | Monorepo, tech stack, frontend + backend structure, auth flow, security | Code likhne se pehle |
| `SUBDOMAINS.md` | Har subdomain pe kaunse pages, kaun khol sakta hai, redirects, DNS | Pages ya routing banate time |
| `DEPLOYMENT.md` | GitHub Actions → Cloudflare Pages, secrets, domains, limits | Deploy karte time |
| `frontend/README.md` | Frontend monorepo ka overview | Frontend kaam shuru karte time |
| `backend/README.md` | Backend services ka overview (baad me) | Backend kaam shuru karte time |

## Locked decisions (2026-11-09, user approved)

| Decision | Kya lock hua |
|---|---|
| Brand / tagline | Kumbuild — Tell us what to build. |
| Service | Done-for-you websites, small business ke liye |
| Monorepo | pnpm workspaces + Turborepo |
| Public site | Astro + React islands (`apps/web`) |
| App | Ek hi Next.js App Router app — admin login + admin dashboard (`apps/app`) |
| Admin | Alag app NAHI — ek hi app me `(admin)` route group, role guard |
| Deploy | Poora frontend GitHub Actions se Cloudflare Pages pe (Vercel plan hata diya) |
| Payment provider | Razorpay (LOCKED 2026-11-09) — UPI, cards, netbanking, wallets; 2% + 18% GST on fee |
| Theme | Option A Trust Blue (LOCKED 2026-11-09) — primary #008EFD (logo wala); Astro sirf light (pure white), Next.js system/light/dark |
| Locales | en-US (default, no URL prefix), hi (`/hi/`), bn (`/bn/`) — shared dictionaries `packages/lib/src/i18n/` (LOCKED 2026-11-09) |
| Backend | Baad me — pehle frontend mock data se complete hoga |
| Code | Abhi code nahi likhna — sirf plan + docs stage hai |

## Draft / TBD — ye final mat samjho

- **Pricing draft hai:** Starter ₹3,999, Business ₹7,999, Premium ₹14,999, renewal ₹1,999/saal. Final nahi hui.
- **Delivery 3–5 din draft hai.**
- **`kumbuild.com` domain ki status TBD hai** — khareeda hai ya nahi, ye doc nahi batata.
- **`auth.kumbuild.com` vs `auth.kumbuilds.com`** — user ne ek baar `kumbuilds` likha tha, typo assume kiya hai, confirm pending hai.
- **Repo: `dusmamud/kumbuild`, public** (2026-11-09; production pe private karna hai — user khud karega).

## Kaam ka order

1. Plan + pricing final karo (`PLAN.md` ke open decisions)
2. `frontend/apps/web` — kumbuild.com landing + order form
3. `frontend/apps/app` — admin login + admin dashboard (mock data)
4. 3 demo sites — shop, clinic, tuition (portfolio)
5. Launch
6. Backend — auth, orders, payments, chat (frontend ke baad)

## Sources — cross-verification

Tech claims Exa se verify kiye gaye hain (2026-11-09):

- Astro vs Next.js marketing site: same site pe Astro ne 14 KB JS bheja, Next.js ne 82 KB; Lighthouse 99 vs 92; INP 90ms vs 210ms. Source: ssg-production.com, 2026-06-18.
- Turborepo: JS/TS-only monorepo task runner, Vercel maintain karta hai. Nx zyada powerful hai par polyglot / distributed CI ke liye hai — solo builder ke liye heavy hai. Source: nx.dev docs.
- Subdomain routing: `auth` + `admin` dono ek hi Cloudflare Pages project (`kumbuild-app`, static export) pe point karte hain — koi middleware nahi, route se tay hota hai. (Static export + next-intl, Exa-verified 2026-11-09.)
- Next.js on Cloudflare: app **sirf static** host hoti hai — `output: "export"` → `wrangler pages deploy out`. Koi Worker/OpenNext nahi (user decision 2026-11-09).
- Creestion deploy pattern: GitHub Actions → `wrangler pages deploy dist` — Dus ke dusrel / creestion projects me pehle se verified hai.

Business claims (problem, customer, pricing) user ke apne words aur decisions se hain — koi market statistic invent nahi ki gayi hai.
