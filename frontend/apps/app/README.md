# apps/app — admin only (ONE Next.js App Router app, STATIC)

Ek hi app, do subdomains — `auth.kumbuild.com` (admin login),
`admin.kumbuild.com` (admin dashboard). **Sirf static export hai**
(`output: "export"`, user decision 2026-11-09: "Next.js ka sirf static
Cloudflare Pages me host karna hai, not Workers"). Pehle OpenNext/Worker
ka plan tha — superseded, saari OpenNext config + dependency hata di gayi.
**Koi server nahi hai: no proxy/middleware, no server actions, no SSR.**

- `auth` — `/login`, `/forgot-password` (sirf admin ke liye)
- `admin` — admin dashboard: `/`, `/orders`, `/orders/new`, `/customers`,
  `/builds`, `/payments`, `/settings`

**Landing + admin only (2026-11-09):** customer dashboard (`home`) hata
diya gaya — customer ka koi account nahi hai. Order WhatsApp DM /
Instagram DM / website form se aata hai; confirm hone ke baad admin use
`/orders/new` se khud add karta hai. `home.*` host ka redirect
`_redirects` se nahi ho sakta (Pages me domain-level redirect supported
nahi hai) — dashboard me **Bulk Redirects** se hoga (DEPLOYMENT.md §6).

Dono subdomains **ek hi Cloudflare Pages project** (`kumbuild-app`) pe
point karte hain — same static files serve hoti hain; login vs dashboard
route se tay hota hai.

Admin alag app NAHI hai — code site ke hisaab se alag modules me hai
(`src/sites/auth|admin`), role guard se protected.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
(`@tailwindcss/postcss`) + next-intl. Deploy: GitHub Actions → Cloudflare
Pages, `next build` (static export) → `wrangler pages deploy out`
(DEPLOYMENT.md). `out/` build output hai — git me nahi jata.

## Kaise chalaye

Repo root se:

```bash
pnpm install            # sirf pehli baar / deps badle hon to
pnpm dev:app            # http://localhost:3000 (Next dev, port 3000)
pnpm build:app          # static export — out/ banta hai, PASS hona chahiye
pnpm --filter kumbuild-app run preview   # wrangler pages dev out — Pages jaisa preview
```

## Local dev — subdomain ki zaroorat nahi hai

Static export hai — plain `http://localhost:3000/login`,
`http://localhost:3000/orders` seedha chalte hain. Production jaisa
preview `wrangler pages dev out` se karo (clean URLs + `_redirects`).

## Mock auth — kaise kaam karta hai (CLIENT SIDE)

Koi backend nahi hai, koi real authentication nahi hai. Static Pages pe
koi server nahi hai, isliye session **browser ke localStorage** me hai
(key `kb_session`, JSON: role/name/email).

- Login form **sirf `admin@kumbuild.com`** accept karta hai — baaki koi
  bhi email reject hota hai (error state, page reload nahi).
  **Password padha hi nahi jata, kahin save/store nahi hota.**
- Login page par **Demo admin** button hai.
- Forgot-password mock hai — koi email asal me nahi bheja jata.
- Guard `RequireAdmin` (client component) me hai: bina session ke admin
  pages `/login` pe bhej dete hain. Login page pehle se logged-in admin
  ko `/` pe bhej deta hai.
- **Ye guard sirf UX hai, security nahi** — asli role check backend
  karega (ARCHITECTURE.md Section 9). Static HTML me admin pages ka
  content pehle se nahi hota (RequireAdmin pehle `null` render karta
  hai) — JS chalne ke baad session check hota hai.

## i18n (static export — next-intl docs ke hisaab se)

Locales: `en-US` (default, URL me prefix nahi), `hi` → `/hi/`,
`bn` → `/bn/`. next-intl + `localePrefix: "as-needed"`.

**Static export me middleware nahi chalta**, isliye structure aisa hai:

- **Default locale (en-US) root par hai** — `/login`, `/orders` (koi
  `/en-US` prefix nahi; `out/` me `/en-US/...` files banti hi nahi).
  Purane `/en-US/...` URLs `public/_redirects` se `301` hote hain.
- **hi/bn `[locale]/` tree me hain** — `/hi/login`, `/bn/orders`. Root
  layout en-US provider deta hai, `[locale]` layout ka nested provider
  use override karta hai.
- **next-intl server APIs bina locale ke NAHI chalti** — `getMessages({
  locale })`, `getTranslations({ locale, namespace })` jaise seedha
  locale pass karo, warna `headers()` fallback build fail kar deta hai
  (`setRequestLocale` ka cache pages tak nahi pahunchta — verify kiya hua).
- **next-intl ka `Link` server component me mat use karo** — woh
  `getServerLocale()` se `headers()` padhta hai. Link wale components
  client hone chahiye. `LocaleSwitcher` plain `next/link` + khud ka href
  banata hai (locale prop default locale par bhi prefix force karta hai
  — static export me `/en-US/...` 404 hota).

Strings **shared dictionaries** se aate hain —
`packages/lib/src/i18n/*.json` (`getDictionary`), is app me apni copy
nahi hai. Par dhyaan do: shared dict me abhi sirf marketing strings
hain (nav, footer, hero...). Dashboard/auth ke labels (jaise "All orders",
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

## Routing — route groups + locale trees

Route groups `(auth)` / `(admin)` URL me nahi aate — sirf layout (shell)
ke liye hain. Locale ke liye **do trees** hain (static export me
middleware nahi hota, isliye `[locale]` segment se default locale
unprefixed nahi milta):

- Root tree (en-US): `src/app/(auth)|(admin)/...` → `/login`, `/orders`
- `[locale]` tree (hi/bn): `src/app/[locale]/(auth)|(admin)/...` →
  `/hi/login`, `/bn/orders`

Dono trees wahi site components render karte hain (`src/sites/*`) —
route files ek jaise hain.

## Mock data

`src/lib/mock.ts` — 6 orders (status flow: Received → In progress →
Preview ready → Revision → Approved → Live), 6 customers, 9 payments
(advance 50% / final 50% / renewal ₹1,999; Razorpay methods UPI/Card/
NetBanking). Prices PRICING.md se: Starter ₹3,999, Business ₹7,999,
Premium ₹14,999. Paise hamesha Indian grouping me (`Intl.NumberFormat`
`en-IN`).

`/orders/new` mock hai — form bharne par reference number milta hai,
order abhi save nahi hota (backend aane pe wahi action save karega).

## Kya abhi nahi hai (TBD)

- Backend, database, real auth, password reset / OTP — sab mock hai.
- Razorpay integration — payments page sirf mock history dikhata hai.
- Status change / customer ko message / revision approve — admin pages
  read-only mock hain (orders/new sirf reference deta hai, save nahi karta).
- `auth.kumbuild.com` vs `auth.kumbuilds.com` — typo confirm pending
  (SUBDOMAINS.md).

## Gotcha — pnpm lockfile (VM)

Is VM pe pnpm lockfile update karte time `EPERM chown` fail hota hai
(overlayfs). Workaround: `pnpm-lock.yaml` aur
`node_modules/.pnpm/lock.yaml` delete karke `pnpm install` dobara chalao
— fresh file ban jati hai, chown nahi lagta.
