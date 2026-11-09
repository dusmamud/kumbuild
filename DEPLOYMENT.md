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
| `kumbuild-app` | `frontend/apps/app` (Next.js) | Cloudflare (OpenNext / Worker) | `auth.kumbuild.com`, `admin.kumbuild.com` |

Project ke naam draft hain — Cloudflare dashboard me banate time final honge. `kumbuild-web` naam is doc me sirf example ke liye hai, kyunki pehle wale short doc me yahi naam likha tha.

## 3. Web — Astro (Cloudflare Pages, seedha)

Ye hissa bilkul Creestion jaisa hai, pehle se verified pattern hai.

- Build: Astro build karta hai → `dist/` folder banta hai
- Deploy: `wrangler pages deploy dist --project-name=kumbuild-web`
- Kyun seedha hai: Astro site static hai — HTML + CSS + JS files. Cloudflare Pages inhe seedha serve kar deta hai.

## 4. App — Next.js (Cloudflare, OpenNext adapter)

Ye hissa static nahi hai. Isme admin login, admin dashboard, middleware aur SSR hai, isliye Pages pe static deploy nahi ho sakta.

- Adapter: `@opennextjs/cloudflare` — Exa-verified, Cloudflare ka ab supported tareeka hai
- Purana tareeka `@cloudflare/next-on-pages` ab recommended nahi hai — woh sirf Edge runtime support karta tha, aur App Router ke features usme poori tarah nahi chalte
- Flow: `opennextjs-cloudflare build` → `.open-next/` bundle banta hai → `wrangler deploy` se Cloudflare pe deploy hota hai
- Cloudflare ab full-stack Next.js ko Workers / OpenNext ki taraf le ja raha hai (Pages se hat ke). Isliye is project ko dashboard me Workers ya Pages — jo bhi OpenNext setup maange — wahi banana hoga, build ke time decide hoga.

### Limits — pehle se jaan lo

| Cheez | Status |
|---|---|
| Normal middleware (subdomain routing) | Chalega |
| Node.js wala middleware (Next.js 15.2+ wala) | Nahi chalega |
| `runtime = "edge"` | Nahi use karna — Node runtime use karenge |
| ISR (revalidate) | R2 / D1 lagte hain — frontend phase me zaroorat nahi, isliye abhi mat chhedo |
| Image optimization | Cloudflare Images alag se lagta hai — frontend phase me zaroorat nahi |

## 5. GitHub Actions

Ek repo, ek workflow file me 2 jobs (ya 2 workflow files — implementation ke time decide hoga, dono me same logic hoga):

| Job | Kab chalega | Kya karega |
|---|---|---|
| `deploy-web` | `frontend/apps/web/**` ya shared `packages/**` change hone pe, push to main | Build web → `wrangler pages deploy dist` |
| `deploy-app` | `frontend/apps/app/**` ya shared `packages/**` change hone pe, push to main | `opennextjs-cloudflare build` → `wrangler deploy` |
| PR check | Kisi bhi PR pe | Sirf lint + build — deploy nahi hoga |

Triggers: `push` to `main` + `workflow_dispatch` (manual). Creestion me ek gotcha tha — git-database API se push karne pe `push` workflow trigger nahi hota tha, manual dispatch karna padta tha. Kumbuild me normal `git push` hoga to ye gotcha nahi aayega, par yaad rakhna hai.

### Secrets (GitHub repo → Settings → Secrets → Actions)

User khud add karega, Creestion jaisa:

| Secret | Kahan se milega |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → API Tokens (Edit Cloudflare Workers / Pages permission wala) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Account overview, right sidebar |

Koi aur secret abhi nahi hai. Backend aane pe alag secrets lagenge, tab alag se add honge.

## 6. Domains — Cloudflare dashboard me

User khud karega (assistant account nahi chhedega — standing boundary):

| Domain | Point karega |
|---|---|
| `kumbuild.com` | Web wala Pages project |
| `auth.kumbuild.com` | App wala project |
| `admin.kumbuild.com` | App wala project |
| `www.kumbuild.com` | `kumbuild.com` pe redirect |

Wildcard `*.kumbuild.com` DNS record se dono app subdomains ek hi project pe jayenge.

## 7. Preview vs production

- `main` branch pe push → production deploy
- PR pe → sirf build check, production deploy nahi
- Preview deployment (PR ka alag link) — Cloudflare Pages pe web ke liye aasan hai, app (OpenNext) ke liye preview ka tareeka build ke time check karna hoga. Is doc me preview ka claim nahi kiya gaya hai.

## 8. Rollback — agar deploy kharab ho jaye

- Cloudflare Pages (web): dashboard se pichhla deployment dobara promote kiya ja sakta hai (Pages deployments list se)
- App (OpenNext / Worker): pichhle wale GitHub run ko dobara chalao ya pichhla commit dobara deploy karo
- **Dhyaan rakhna:** Direct Upload deployments ko API se retry nahi kiya ja sakta — ye Creestion ke time verify hua tha. Isliye kharab deploy ko retry karne ki koshish mat karo, pichhla sahi deployment wapas lao.

## 9. Pehle deploy se pehle checklist

- [x] GitHub repo bana — `dusmamud/kumbuild`, public (2026-11-09, commit f32dca7; production pe private karna hai — user khud karega)
- [ ] `kumbuild.com` domain ki status confirm (khareeda ya nahi — TBD)
- [ ] Cloudflare me 2 projects bane (web + app)
- [ ] GitHub Secrets add hue (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — user khud)
- [ ] DNS / custom domains lage
- [ ] Pehla deploy manual `workflow_dispatch` se karke verify karo, phir auto-deploy pe bharosa karo

## 10. Kya is doc me nahi hai (TBD)

- Backend ka deploy — backend banega tab alag doc banega
- Database ka deploy — TBD
- Payment provider ke secrets — TBD
- Preview deployment ka exact tareeka (app ke liye) — build ke time check karna hai
