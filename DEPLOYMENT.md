# Kumbuild — Deployment

Status: **LOCKED (2026-11-09, user decision).**

Decision: **poora frontend GitHub Actions se Cloudflare pe host hoga.** Pehle Vercel ka plan tha, user ne use hata ke Cloudflare kar diya. Ye decision final hai.

## 1. Principles

1. **Sirf GitHub Actions se deploy hoga.** Haath se `wrangler deploy` karke production nahi badla jayega (local test alag baat hai).
2. **Cloudflare dashboard me Git integration connect nahi karenge.** Creestion / dusrel wala pattern hai — GitHub Action build karta hai, Wrangler Direct Upload karta hai. Cloudflare Pages project ka `source: null` rahega.
3. **Push to main = production deploy.** PR pe sirf build + lint chalega, deploy nahi hoga.
4. **Secrets code me kabhi nahi.** Sirf GitHub Secrets me. User khud add karega.
5. **Ek app badla to sirf wahi deploy hoga.** Doosra app dobara deploy nahi hoga.

## 2. Projects

| Project | App | Type | Custom domain |
|---|---|---|---|
| `kumbuild-web` | `frontend/apps/web` (Astro) | Cloudflare Pages (static) | `kumbuild.com` |
| `kumbuild-app` | `frontend/apps/app` (Next.js) | Cloudflare Pages (static export) | `auth.kumbuild.com`, `admin.kumbuild.com` |

Project ke naam draft hain — Cloudflare dashboard me banate time final honge. `kumbuild-web` naam is doc me sirf example ke liye hai, kyunki pehle wale short doc me yahi naam likha tha.

## 3. Web — Astro (Cloudflare Pages, seedha)

Ye hissa bilkul Creestion jaisa hai, pehle se verified pattern hai.

- Build: Astro build karta hai → `dist/` folder banta hai
- Deploy: `wrangler pages deploy dist --project-name=kumbuild-web`
- Kyun seedha hai: Astro site static hai — HTML + CSS + JS files. Cloudflare Pages inhe seedha serve kar deta hai.

## 4. App — Next.js (Cloudflare Pages, STATIC export)

Ye hissa **sirf static hai** — user decision (2026-11-09): "Next.js ka sirf static Cloudflare Pages me host karna hai, not Workers". Pehle OpenNext/Worker ka plan tha — **superseded**. Koi server nahi hai: no proxy/middleware, no server actions, no SSR. Login/session localStorage me hai, guards client-side hain (ARCHITECTURE.md Section 5).

- Build: `next build` with `output: "export"` → `out/` folder banta hai (pure HTML/CSS/JS)
- Deploy: `wrangler pages deploy out --project-name=kumbuild-app` (web jaisa hi pattern)
- Pehla deploy: workflow me `wrangler pages project create kumbuild-app || true` step hai — project pehli baar khud ban jata hai. **Purana blank Hello World Worker (`kumbuild-app`) ab bekaar hai** — deploy usse nahi chhedega; user chahe to dashboard se delete kar de (free tier, chhodna bhi safe hai).
- Dono subdomains (`auth.` + `admin.`) **ek hi Pages project** pe point karte hain — same static files serve hoti hain; login vs dashboard route se tay hota hai (SUBDOMAINS.md).
- `_redirects` (public/ me, build me out/ me copy hota hai): `/en-US/*` → `/:splat` 301 — default locale ka prefix nahi hota (THEME.md Section 6).
- `home.kumbuild.com` → `kumbuild.com` redirect `_redirects` se NAHI ho sakta (Cloudflare Pages me domain-level redirect supported nahi hai) — iske liye dashboard me **Bulk Redirects** (user khud, §6 dekho).

### Limits — pehle se jaan lo

| Cheez | Status |
|---|---|
| Proxy/middleware (subdomain routing) | Nahi hai — routes se tay hota hai, guards client-side hain |
| Server actions / API routes | Nahi hain — forms client-side mock hain |
| `searchParams` / `cookies()` / `headers()` server pe | Nahi chalte — static export me build fail hota hai |
| next-intl server APIs bina locale ke | Nahi — locale hamesha seedha pass karo (`getMessages({ locale })`); server `Link` mat use karo (client component me use karo) |
| ISR / revalidate / Image optimization | Nahi — static export me nahi hota; frontend phase me zaroorat nahi |
| Client-side navigation | Chalta hai — par `/en-US/...` URLs nahi hain (redirects §6) |

## 5. GitHub Actions

Ek repo, ek workflow file me 2 jobs (ya 2 workflow files — implementation ke time decide hoga, dono me same logic hoga):

| Job | Kab chalega | Kya karega |
|---|---|---|
| `deploy-web` | `frontend/apps/web/**` ya shared `packages/**` change hone pe, push to main | Build web → `wrangler pages deploy dist` |
| `deploy-app` | `frontend/apps/app/**` ya shared `packages/**` change hone pe, push to main | Build app (static export) → `wrangler pages deploy out` |
| PR check | Kisi bhi PR pe | Sirf lint + build — deploy nahi hoga |

Triggers: `push` to `main` + `workflow_dispatch` (manual). Git-database API se push karne pe bhi `push` workflow trigger hota hai (runs 42619040189/42619040220/42619755398 se verified) — Creestion wala gotcha yahan lagu nahi hota.

### Secrets (GitHub repo → Settings → Secrets → Actions)

User khud add karega, Creestion jaisa:

| Secret | Kahan se milega |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → API Tokens (Cloudflare Pages: Edit permission wala — **Workers permission ki zaroorat NAHI hai**; purana token error isi liye ab nahi aayega) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Account overview, right sidebar |

Koi aur secret abhi nahi hai. Backend aane pe alag secrets lagenge, tab alag se add honge.

## 6. Domains — Cloudflare dashboard me

User khud karega (assistant account nahi chhedega — standing boundary):

| Domain | Point karega |
|---|---|
| `kumbuild.com` | Web wala Pages project |
| `auth.kumbuild.com` | App wala Pages project (`kumbuild-app`) |
| `admin.kumbuild.com` | App wala Pages project (`kumbuild-app`) — auth ke saath ek hi project |
| `www.kumbuild.com` | `kumbuild.com` pe redirect |
| `home.kumbuild.com` | **Bulk Redirects** (dashboard → Rules → Bulk Redirects): `home.kumbuild.com/*` → `https://kumbuild.com/:splat` 301. `_redirects` file se domain-level redirect nahi hota (Cloudflare Pages limitation, Exa-verified). |

Wildcard `*.kumbuild.com` DNS record se dono app subdomains ek hi project pe jayenge.

## 7. Preview vs production

- `main` branch pe push → production deploy
- PR pe → sirf build check, production deploy nahi
- Preview deployment (PR ka alag link) — Cloudflare Pages pe web aur app dono ke liye aasan hai (dono static hain — har deploy ka apna `*.pages.dev` preview URL banta hai).

## 8. Rollback — agar deploy kharab ho jaye

- Cloudflare Pages (web + app — dono static): dashboard se pichhla deployment dobara promote kiya ja sakta hai (Pages deployments list se)
- **Dhyaan rakhna:** Direct Upload deployments ko API se retry nahi kiya ja sakta — ye Creestion ke time verify hua tha. Isliye kharab deploy ko retry karne ki koshish mat karo, pichhla sahi deployment wapas lao.

## 9. Pehle deploy se pehle checklist

- [x] GitHub repo bana — `dusmamud/kumbuild`, public (2026-11-09, commit f32dca7; production pe private karna hai — user khud karega)
- [ ] `kumbuild.com` domain ki status confirm (khareeda ya nahi — TBD)
- [ ] Cloudflare me 2 Pages projects bane (web `kumbuild-web` LIVE + app `kumbuild-app` — workflow pehli baar khud bana dega)
- [ ] GitHub Secrets add hue (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — user khud; token ko sirf Pages: Edit chahiye)
- [ ] DNS / custom domains lage (auth + admin → `kumbuild-app` Pages project; `home.*` → Bulk Redirects)
- [ ] Pehla deploy manual `workflow_dispatch` se karke verify karo, phir auto-deploy pe bharosa karo

## 10. Kya is doc me nahi hai (TBD)

- Backend ka deploy — backend banega tab alag doc banega
- Database ka deploy — TBD
- Payment provider ke secrets — TBD
- Preview deployment ka exact tareeka (app ke liye) — build ke time check karna hai
