# Kumbuild — Deployment

Status: **LOCKED (2026-11-09, user decision) — 2026-11-11 ko 6-app plan se updated.**

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
| `kumbuild-account` | `frontend/apps/account` (React+Vite) | Cloudflare Pages (static) | `account.kumbuild.com` |
| `kumbuild-admin` | `frontend/apps/admin` (React+Vite) | Cloudflare Pages (static) | `admin.kumbuild.com` |
| `kumbuild-home` | `frontend/apps/home` (React+Vite) | Cloudflare Pages (static) | `home.kumbuild.com` |
| `kumbuild-blog` | `frontend/apps/blog` (Astro 7) | Cloudflare Pages (static) | `blog.kumbuild.com` |
| `kumbuild-docs` | `frontend/apps/docs` (Astro 7 + Starlight) | Cloudflare Pages (static) | `docs.kumbuild.com` |
| `kumbuild-app` | `frontend/apps/app` (Next.js, LEGACY) | Cloudflare Pages (static export) | — (purane `auth.`/`admin.` domains; Vite apps live hote hi delete) |

**Chhe projects ban gaye hain** (user ne Cloudflare dashboard me bana liye, 2026-11-11). Har push to main pe badla hua app apne project pe deploy hota hai.

## 3. Web — Astro (Cloudflare Pages, seedha)

Ye hissa bilkul Creestion jaisa hai, pehle se verified pattern hai.

- Build: Astro build karta hai → `dist/` folder banta hai
- Deploy: `wrangler pages deploy dist --project-name=kumbuild-web`
- Kyun seedha hai: Astro site static hai — HTML + CSS + JS files. Cloudflare Pages inhe seedha serve kar deta hai.
- **Blog + Docs bhi Astro hain** (`apps/blog`, `apps/docs`) — same pattern: `astro build` → `dist/` → `wrangler pages deploy dist --project-name=kumbuild-blog` / `kumbuild-docs` (workflows `deploy-blog` / `deploy-docs`).

## 4. Vite apps — account / admin / home (Cloudflare Pages, STATIC)

Teeno apps **sirf static** hain — `vite build` → `dist/` folder banta hai (pure HTML/CSS/JS). Koi server nahi hai: no SSR, no server actions, no API routes. Login/session localStorage me hai (mock phase), guards client-side hain (ARCHITECTURE.md Section 5).

- Build: `pnpm --filter kumbuild-account build` (ya admin/home)
- Deploy: `wrangler pages deploy frontend/apps/account/dist --project-name=kumbuild-account` (admin/home ke liye naam badlo)
- Har app ka apna workflow hai (Section 5) — ek app badla to sirf wahi deploy hota hai.

### Limits — pehle se jaan lo (teeno Vite apps)

| Cheez | Status |
|---|---|
| Server / API routes | Nahi hain — frontend sirf static hai; data mock (`packages/lib`) se ya backend API se aayega |
| `searchParams` / cookies server pe | Nahi chalte — koi server hi nahi hai |
| Auth / role check | Client-side guard sirf UX hai — asli check Go backend har API call pe karega |

### LEGACY — Next.js app (`kumbuild-app`, STATIC export)

Ye hissa **sirf static hai** — user decision (2026-11-09): "Next.js ka sirf static Cloudflare Pages me host karna hai, not Workers". Pehle OpenNext/Worker ka plan tha — **superseded**. Koi server nahi hai: no proxy/middleware, no server actions, no SSR. Login/session localStorage me hai, guards client-side hain (ARCHITECTURE.md Section 5, legacy note).

- Build: `next build` with `output: "export"` → `out/` folder banta hai (pure HTML/CSS/JS)
- Deploy: `wrangler pages deploy out --project-name=kumbuild-app` (web jaisa hi pattern)
- **Purana blank Hello World Worker (`kumbuild-app`) ab bekaar hai** — deploy usse nahi chhedega; user chahe to dashboard se delete kar de (free tier, chhodna bhi safe hai).
- `_redirects` (public/ me, build me out/ me copy hota hai): `/en-US/*` → `/:splat` 301 — default locale ka prefix nahi hota (THEME.md Section 6).
- Vite admin app live hote hi ye legacy app + `kumbuild-app` project hata diye jayenge.

## 5. GitHub Actions

Ek repo, 6 workflow files (`.github/workflows/deploy-*.yml`) + `pr-check.yml`:

| Workflow | Kab chalega | Kya karega |
|---|---|---|
| `deploy-web` | `frontend/apps/web/**` ya shared `packages/**` change hone pe, push to main | Build web → `wrangler pages deploy dist` (`kumbuild-web`) |
| `deploy-account` | `frontend/apps/account/**` ya shared `packages/**` change hone pe, push to main | Build account → `wrangler pages deploy dist` (`kumbuild-account`) |
| `deploy-admin` | `frontend/apps/admin/**` ya shared `packages/**` change hone pe, push to main | Build admin → `wrangler pages deploy dist` (`kumbuild-admin`) |
| `deploy-home` | `frontend/apps/home/**` ya shared `packages/**` change hone pe, push to main | Build home → `wrangler pages deploy dist` (`kumbuild-home`) |
| `deploy-blog` | `frontend/apps/blog/**` ya shared `packages/**` change hone pe, push to main | Build blog → `wrangler pages deploy dist` (`kumbuild-blog`) |
| `deploy-docs` | `frontend/apps/docs/**` ya shared `packages/**` change hone pe, push to main | Build docs → `wrangler pages deploy dist` (`kumbuild-docs`) |
| `deploy-app` (legacy) | `frontend/apps/app/**` ya shared `packages/**` change hone pe, push to main | Build legacy Next.js app (static export) → `wrangler pages deploy out` (`kumbuild-app`) |
| PR check | Kisi bhi PR pe | Sirf build (saaton apps: web, account, admin, home, blog, docs, app) — deploy nahi hoga |

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
| `kumbuild.com` | Web wala Pages project (`kumbuild-web`) |
| `account.kumbuild.com` | Pages project `kumbuild-account` |
| `admin.kumbuild.com` | Pages project `kumbuild-admin` |
| `home.kumbuild.com` | Pages project `kumbuild-home` |
| `blog.kumbuild.com` | Pages project `kumbuild-blog` |
| `docs.kumbuild.com` | Pages project `kumbuild-docs` |
| `www.kumbuild.com` | `kumbuild.com` pe redirect |

`kumbuild.com` domain abhi nahi khareeda (user ko registrar pe check karna hai) — custom domains domain khareedne ke baad lagenge. Tab tak apps apne `*.pages.dev` URLs pe chalenge.

## 7. Preview vs production

- `main` branch pe push → production deploy (badla hua app hi deploy hota hai)
- PR pe → sirf build check, production deploy nahi
- Preview deployment (PR ka alag link) — Cloudflare Pages pe chhe apps ke liye aasan hai (sab static hain — har deploy ka apna `*.pages.dev` preview URL banta hai).

## 8. Rollback — agar deploy kharab ho jaye

- Cloudflare Pages (chhe apps — sab static): dashboard se pichhla deployment dobara promote kiya ja sakta hai (Pages deployments list se)
- **Dhyaan rakhna:** Direct Upload deployments ko API se retry nahi kiya ja sakta — ye Creestion ke time verify hua tha. Isliye kharab deploy ko retry karne ki koshish mat karo, pichhla sahi deployment wapas lao.

## 9. Pehle deploy se pehle checklist

- [x] GitHub repo bana — `dusmamud/kumbuild`, public (2026-11-09, commit f32dca7; production pe private karna hai — user khud karega)
- [ ] `kumbuild.com` domain ki status confirm (abhi nahi khareeda — user ko registrar pe check karna hai)
- [x] Cloudflare me 6 Pages projects bane (web `kumbuild-web` LIVE + account `kumbuild-account` + admin `kumbuild-admin` + home `kumbuild-home` + blog `kumbuild-blog` + docs `kumbuild-docs` — user ne bana liye, 2026-11-11)
- [x] GitHub Secrets add hue (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — user khud; token ko sirf Pages: Edit chahiye)
- [ ] DNS / custom domains lage (domain khareedne ke baad: kumbuild.com → web, account/admin/home → apne projects)
- [ ] Pehla deploy `main` push pe hoga — deploy-account/admin/home runs green hone pe live URLs verify karo

## 10. Kya is doc me nahi hai (TBD)

- Backend ka deploy — **LOCKED (2026-11-11): GitHub Actions workflow se Oracle VPS pe hoga** (workflow + VPS secrets setup backend build ke time pe; `api.kumbuild.com` ke liye domain khareedna baki hai)
- Database ka deploy — **LOCKED (2026-11-11): PostgreSQL, Oracle VPS pe hi** (install + nightly backup backend build ke time pe)
- Payment provider ke secrets — TBD
- Preview deployment ka exact tareeka (app ke liye) — build ke time check karna hai
