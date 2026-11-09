# apps/app — auth + home + admin (ONE Next.js App Router app)

Ek hi app, teen subdomains — `auth.kumbuild.com`, `home.kumbuild.com`,
`admin.kumbuild.com`. Proxy (Next 16 me middleware ka naya naam,
`src/proxy.ts`) host dekh ke sahi site par bhejta hai.

- `auth` — `/login`, `/signup`, `/forgot-password`, `/verify`
- `home` — customer dashboard: `/`, `/orders`, `/orders/[id]`, `/my-website`,
  `/payments`, `/support`, `/settings`
- `admin` — admin dashboard: `/`, `/orders`, `/customers`, `/builds`,
  `/payments`, `/settings`

Admin alag app NAHI hai — code site ke hisaab se alag modules me hai
(`src/sites/auth|home|admin`), role guard se protected.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
(`@tailwindcss/postcss`) + next-intl. Deploy: GitHub Actions → Cloudflare,
`@opennextjs/cloudflare` adapter (DEPLOYMENT.md) — normal proxy chalta hai,
Node proxy / `runtime="edge"` nahi. Deploy is scaffold me nahi hai.

## Kaise chalaye

Repo root se:

```bash
pnpm install            # sirf pehli baar / deps badle hon to
pnpm dev:app            # http://localhost:3000 (Next dev, port 3000)
pnpm build:app          # production build — PASS hona chahiye
```

## Local dev — subdomain kaise test karein

Production me host hi site batata hai (`auth.` / `home.` / `admin.`).
Localhost par do tareeke hain:

1. **`*.localhost` trick (recommended):**
   `http://auth.localhost:3000/login`,
   `http://home.localhost:3000/orders`,
   `http://admin.localhost:3000/` — `*.localhost` khud 127.0.0.1
   resolve karta hai, kuch setup nahi chahiye.
2. **Path fallback (plain localhost):**
   `http://localhost:3000/auth/login`,
   `http://localhost:3000/home/orders`,
   `http://localhost:3000/admin` — host plain `localhost` ho to URL ke
   pehle segment se site decide hoti hai. Locale pehle bhi aa sakta hai:
   `/hi/home/orders` aur `/home/hi/orders` dono chalte hain.

Limitation: mock session cookie localhost par host-only hoti hai
(production me `.kumbuild.com` domain par set hoti hai, taaki ek login
teeno subdomains par chale). Isliye `*.localhost` par login karke dusre
subdomain par session nahi jayega — poora login flow local me **path
fallback** (`localhost:3000/...`) par test karo, wahan ek hi host hai.

## Mock auth — kaise kaam karta hai

Koi backend nahi hai, koi real authentication nahi hai.

- Login form koi bhi email + koi bhi password accept karta hai.
  **Password padha hi nahi jata, kahin save/store nahi hota.**
- Role email se tay hota hai: `admin@kumbuild.com` → admin, baaki sab →
  customer. Login page par **Demo customer** aur **Demo admin** button
  hain.
- Session `kb_session` cookie me hai (base64url JSON: role/name/email,
  httpOnly, 7 din). Signup turant customer login kar deta hai. Verify
  page koi bhi 6-digit code accept karta hai.
- Guards proxy me hain (SUBDOMAINS.md matrix):
  bina login → home/admin se `/login`; customer admin khole → home;
  logged-in user auth khole → apne dashboard par.
- **Ye guard sirf UX hai, security nahi** — asli role check backend
  karega (ARCHITECTURE.md Section 9).

## i18n

Locales: `en-US` (default, URL me prefix nahi), `hi` → `/hi/`,
`bn` → `/bn/`. next-intl + `[locale]` segment,
`localePrefix: "as-needed"`. Detection priority: URL > `NEXT_LOCALE`
cookie > `Accept-Language` > default.

Strings **shared dictionaries** se aate hain —
`packages/lib/src/i18n/*.json` (`getDictionary`), is app me apni copy
nahi hai. Par dhyaan do: shared dict me abhi sirf marketing strings
hain (nav, footer, hero...). Dashboard/auth ke labels (jaise "My orders",
"Status") abhi components me literal English me hain — unke liye shared
dict me keys add honi baaki hain (packages/lib edit karna is task ke
scope se bahar tha). Jab keys add hongi, `getTranslations()` se use
karna hai — footer tagline aur login heading pehle se waise hi aate hain
(`/bn/login` par "লগইন" dikhta hai — verify kiya hua).

## Theme

Option A Trust Blue (THEME.md). Astro wala light-only rule yahan **nahi**
hai: system / light / dark. Default system, choice `kb_theme` cookie me
save hoti hai, `<head>` me no-flash inline script paint se pehle
`data-theme` set karta hai. Tokens CSS variables hain —
`src/app/globals.css` me `:root` (light) + `[data-theme="dark"]`.

## Routing — route groups kyun nahi hain

Pehle `(auth)` / `(home)` / `(admin)` route groups try kiye the — Next.js
build fail hota hai: *"You cannot have two parallel pages that resolve
to the same path"* (teeno groups me `/`, `/orders`, `/payments`,
`/settings` same URL par resolve hote hain). Isliye routing `[site]`
dynamic segment se hoti hai (`src/app/[locale]/[site]/...`), aur code
`src/sites/auth|home|admin` modules me alag hai — thin route files sirf
site check karke sahi module render karte hain. Bahar se URL wahi dikhta
hai (segment URL me nahi aata — proxy rewrite karta hai).

## Mock data

`src/lib/mock.ts` — 6 orders (status flow: Received → In progress →
Preview ready → Revision → Approved → Live), 6 customers, 9 payments
(advance 50% / final 50% / renewal ₹1,999; Razorpay methods UPI/Card/
NetBanking). Prices PRICING.md se: Starter ₹3,999, Business ₹7,999,
Premium ₹14,999. Paise hamesha Indian grouping me (`Intl.NumberFormat`
`en-IN`).

## Kya abhi nahi hai (TBD)

- Backend, database, real auth, password reset / OTP — sab mock hai.
- Razorpay integration — payments page sirf mock history dikhata hai.
- Status change / customer ko message / revision approve — admin pages
  read-only mock hain.
- OpenNext / Cloudflare deploy config (`opennextjs-cloudflare`) — scaffold
  us hisaab se banaya hai (normal proxy, koi edge runtime nahi), par
  `wrangler` config aur GitHub workflow abhi nahi hai.
- `auth.kumbuild.com` vs `auth.kumbuilds.com` — typo confirm pending
  (SUBDOMAINS.md).

## Gotcha — pnpm lockfile (VM)

Is VM pe pnpm lockfile update karte time `EPERM chown` fail hota hai
(overlayfs). Workaround: `pnpm-lock.yaml` aur
`node_modules/.pnpm/lock.yaml` delete karke `pnpm install` dobara chalao
— fresh file ban jati hai, chown nahi lagta.
