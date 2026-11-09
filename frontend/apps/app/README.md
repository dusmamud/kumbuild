# apps/app — admin only (ONE Next.js App Router app)

Ek hi app, do subdomains — `auth.kumbuild.com` (admin login),
`admin.kumbuild.com` (admin dashboard). Proxy (Next 16 me middleware ka
naya naam, `src/proxy.ts`) host dekh ke sahi site par bhejta hai.

- `auth` — `/login`, `/forgot-password` (sirf admin ke liye)
- `admin` — admin dashboard: `/`, `/orders`, `/orders/new`, `/customers`,
  `/builds`, `/payments`, `/settings`

**Landing + admin only (2026-11-09):** customer dashboard (`home`) hata
diya gaya — customer ka koi account nahi hai. Order WhatsApp DM /
Instagram DM / website form se aata hai; confirm hone ke baad admin use
`/orders/new` se khud add karta hai. `home.*` host aaye to proxy seedha
`kumbuild.com` pe redirect kar deta hai.

Admin alag app NAHI hai — code site ke hisaab se alag modules me hai
(`src/sites/auth|admin`), role guard se protected.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
(`@tailwindcss/postcss`) + next-intl. Deploy: GitHub Actions → Cloudflare,
`@opennextjs/cloudflare` adapter (DEPLOYMENT.md) — normal proxy chalta hai,
Node proxy / `runtime="edge"` nahi.

## Kaise chalaye

Repo root se:

```bash
pnpm install            # sirf pehli baar / deps badle hon to
pnpm dev:app            # http://localhost:3000 (Next dev, port 3000)
pnpm build:app          # production build — PASS hona chahiye
```

## Local dev — subdomain kaise test karein

Production me host hi site batata hai (`auth.` / `admin.`).
Localhost par do tareeke hain:

1. **`*.localhost` trick (recommended):**
   `http://auth.localhost:3000/login`,
   `http://admin.localhost:3000/` — `*.localhost` khud 127.0.0.1
   resolve karta hai, kuch setup nahi chahiye.
2. **Path fallback (plain localhost):**
   `http://localhost:3000/auth/login`,
   `http://localhost:3000/admin` — host plain `localhost` ho to URL ke
   pehle segment se site decide hoti hai. Locale pehle bhi aa sakta hai:
   `/hi/admin/orders` aur `/admin/hi/orders` dono chalte hain.

Limitation: mock session cookie localhost par host-only hoti hai
(production me `.kumbuild.com` domain par set hoti hai, taaki ek login
dono subdomains par chale). Isliye `*.localhost` par login karke dusre
subdomain par session nahi jayega — poora login flow local me **path
fallback** (`localhost:3000/...`) par test karo, wahan ek hi host hai.

## Mock auth — kaise kaam karta hai

Koi backend nahi hai, koi real authentication nahi hai.

- Login form **sirf `admin@kumbuild.com`** accept karta hai — baaki koi
  bhi email reject hota hai (`?error=not-admin`).
  **Password padha hi nahi jata, kahin save/store nahi hota.**
- Login page par **Demo admin** button hai.
- Session `kb_session` cookie me hai (base64url JSON: role/name/email,
  httpOnly, 7 din). Forgot-password mock hai — koi email asal me nahi
  bheja jata.
- Guards proxy me hain (SUBDOMAINS.md matrix):
  bina login → admin se `/login`; logged-in admin auth khole → admin
  dashboard par.
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

## Routing — route groups kyun nahi hain

Pehle `(auth)` / `(home)` / `(admin)` route groups try kiye the — Next.js
build fail hota hai: *"You cannot have two parallel pages that resolve
to the same path"* (groups me `/`, `/orders`, `/payments`,
`/settings` same URL par resolve hote hain). Isliye routing `[site]`
dynamic segment se hoti hai (`src/app/[locale]/[site]/...`), aur code
`src/sites/auth|admin` modules me alag hai — thin route files sirf
site check karke sahi module render karte hain. Bahar se URL wahi dikhta
hai (segment URL me nahi aata — proxy rewrite karta hai).

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
