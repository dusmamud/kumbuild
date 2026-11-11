# Kumbuild — Subdomain Structure

Status: **LOCKED (2026-11-09) — 2026-11-11 ko 6-app plan se UPDATED.**

Note: `auth.kumbuild.com` khatam hai — ab **`account.kumbuild.com`** hai (central login/signup). `auth.kumbuilds.com` (s wala) typo tha, ab irrelevant hai.

## Overview

**6 apps hain: main landing page, central login/signup, admin dashboard, customer dashboard, blog, aur docs.** Customer `account.kumbuild.com` pe signup/login karta hai aur apne orders `home.kumbuild.com` pe track karta hai. Order WhatsApp DM, Instagram DM ya website form se aayega. Jo confirm hoga, admin (Dus) use khud admin dashboard me add karega aur saari progress wahin track karega — customer ko status WhatsApp pe bhi milega.

| Subdomain | App | Kaam | Kaun khol sakta hai |
|---|---|---|---|
| `kumbuild.com` | `frontend/apps/web` (Astro) | Public site — landing, pricing, order | Koi bhi, bina login |
| `account.kumbuild.com` | `frontend/apps/account` (React+Vite) | Central login/signup — dono roles | Koi bhi, bina login — login/signup karne ki jagah hai |
| `admin.kumbuild.com` | `frontend/apps/admin` (React+Vite) | Admin dashboard | Sirf logged-in admin (Dus) |
| `home.kumbuild.com` | `frontend/apps/home` (React+Vite) | Customer dashboard — my orders, status, profile | Sirf logged-in customer (apne orders hi) |
| `blog.kumbuild.com` | `frontend/apps/blog` (Astro 7) | Blog — posts (user ne banaya 2026-11-11) | Koi bhi, bina login |
| `docs.kumbuild.com` | `frontend/apps/docs` (Astro 7 + Starlight) | Help docs (user ne banaya 2026-11-11) | Koi bhi, bina login |

Har app **apna alag Cloudflare Pages project** hai (static SPA). **LEGACY:** purana Next.js app (`apps/app`, project `kumbuild-app`) abhi live hai (https://kumbuild-app.pages.dev) — auth + admin ek hi app me the. Vite apps live hote hi use hata diya jayega.

## 1. kumbuild.com — Public website (Astro)

Login nahi chahiye. Ye customer ko pehli baar dikhega.

| Route | Page | Kya hoga |
|---|---|---|
| `/` | Home / landing | Kya hai Kumbuild, kiske liye hai, kaise kaam karta hai, CTA — order karo |
| `/pricing` | Pricing | Teen packages + renewal, kya included hai, payment terms |
| `/services` | Services | 4 services — business website, landing page, booking, catalogue |
| `/services/[slug]` | Service detail | Ek service ki detail (agar banani ho to; nahi to `/services` hi kaafi hai) |
| `/examples` | Examples / portfolio | Demo websites — shop, clinic, tuition (Phase 3 me banenge) |
| `/examples/[slug]` | Example detail | Ek demo website ki detail |
| `/how-it-works` | Kaise kaam karta hai | Steps — batao (WhatsApp / Instagram / form), advance, preview, approve, live |
| `/order` | Order form | Package choose + business details + photos + WhatsApp number |
| `/faq` | FAQ | Aam sawaal — price, time, revision, renewal |
| `/about` | About | Kumbuild kya hai (ABOUT.md wala content, website version) |
| `/contact` | Contact | WhatsApp / Instagram se contact |
| `/privacy` | Privacy policy | Data kaise use hoga |
| `/terms` | Terms | Service ki shartein |

SEO: sirf ye subdomain Google pe index hoga. Har page ka apna title + description hoga.

## 2. account.kumbuild.com — Central login/signup (React+Vite)

Login nahi chahiye — ye login/signup karne ki jagah hai. **Dono roles yahin login karte hain — admin bhi, customer bhi.**

| Route | Page | Kya hoga |
|---|---|---|
| `/login` | Login | Email + password — admin ya customer, dono |
| `/signup` | Signup | Naya customer account — naam + email + password |
| `/forgot-password` | Password reset | Reset link bhejega (backend ke saath; mock phase me koi email nahi bhejta) |

**Login ke baad — role redirect:** admin → `admin.kumbuild.com`, customer → `home.kumbuild.com`. Mock phase me redirect ke saath `?demo_session=` handoff jata hai (DEMO ONLY — production me Go backend ka HttpOnly cookie `Domain=.kumbuild.com` aayega, jo SSO dega).

**Pehle se logged-in user account khole to:** seedha uske role app pe bhej do, dobara login page mat dikhao (login page khud session check karke redirect karta hai).

## 3. admin.kumbuild.com — Admin dashboard (React+Vite)

Sirf logged-in admin (Dus). Bina login ke koi bhi page kholo to `account.kumbuild.com/login` pe redirect (client-side guard `RequireRole` — static SPA me server guard nahi hota).

| Route | Page | Kya hoga |
|---|---|---|
| `/` | Admin dashboard | Aaj ke orders, pending kaam, revenue summary (draft) |
| `/orders` | Saare orders | Har order, **naya order add karo (confirm hua order yahin add hoga)**, status change karo, customer ko WhatsApp pe update do |
| `/orders/new` | Order add karo | Confirm hue order ki details daalo — customer, package, advance, content |
| `/orders/:id` | Order detail | Ek order ki poori detail — status, customer, payments, preview/live links, notes |
| `/customers` | Customers | Saare customers, unki websites aur orders |
| `/builds` | Builds | Kaunsi website kis stage pe hai — build / preview / live |
| `/payments` | Payments | Saare payments, advance / final / renewal |
| `/settings` | Admin settings | Admin profile aur settings |

**Order add karna admin ka kaam hai:** WhatsApp DM, Instagram DM ya form se jo order aaye aur confirm ho, admin use yahan add karega. Customer khud order add nahi karta — uska order form / DM se aata hai, phir admin confirm karke dashboard me add karta hai.

## 4. home.kumbuild.com — Customer dashboard (React+Vite)

Sirf logged-in customer. Bina login ke koi bhi page kholo to `account.kumbuild.com/login` pe redirect (client-side guard `RequireRole`). **Customer sirf apne orders dekhta hai** — doosre customer ka order kholo to "Order not found" dikhega.

| Route | Page | Kya hoga |
|---|---|---|
| `/` | My orders | "Hi, {name}" — apne orders ki list: package, price, advance paid, balance due, status, "what happens next" |
| `/orders/:id` | Order detail | 6-step status stepper (Received → Live), payment summary, preview/live links, revisions used, team notes, WhatsApp button |
| `/profile` | Profile | Naam, email, phone, business — read-only (badalna ho to WhatsApp pe bolo) |

**Customer ko status yahan bhi dikhta hai aur WhatsApp pe bhi milta hai** — dono chalte hain.

## Guards matrix (client-side — static SPAs me server guard nahi hota)

| Kholne wala | `kumbuild.com` | `account.kumbuild.com` | `admin.kumbuild.com` | `home.kumbuild.com` |
|---|---|---|---|---|
| Bina login | ✅ khulega | ✅ khulega | ❌ → `account.../login` (client-side) | ❌ → `account.../login` (client-side) |
| Admin (logged in) | ✅ khulega | → admin dashboard | ✅ khulega | ❌ → admin dashboard (galat role) |
| Customer (logged in) | ✅ khulega | → home dashboard | ❌ → home dashboard (galat role) | ✅ khulega (sirf apne orders) |

Guards sirf UX hain — asli role check Go backend har API call pe karega.

## Redirects

| From | To | Kaise |
|---|---|---|
| `www.kumbuild.com/*` | `kumbuild.com/*` (same path) | DNS / Pages setting |
| `kumbuild.com/login` (agar koi type kare) | `account.kumbuild.com/login` | Web app (Astro) ki `_redirects` se (baad me) |
| `kumbuild.com/signup` (agar koi type kare) | `account.kumbuild.com/signup` | Web app (Astro) ki `_redirects` se (baad me) |
| `kumbuild.com/dashboard` (agar koi type kare) | `account.kumbuild.com/login` | Web app (Astro) ki `_redirects` se (baad me) |
| Unknown subdomain, jaise `xyz.kumbuild.com` | `kumbuild.com` | DNS me record na banao |
| Login ke baad (role se) | admin → `admin.kumbuild.com`, customer → `home.kumbuild.com` | Client-side (account app, `?demo_session=` handoff mock phase me) |
| `/en-US/*` (purana prefixed URL — legacy Next.js app) | `/*` (same path) | Legacy app ki `_redirects`: `/en-US/* /:splat 301` |

`home.kumbuild.com` ab ek real app hai — purana `home.* → kumbuild.com` Bulk Redirect plan **khatam** hai (2026-11-11).

## Poora flow — ek order ki kahani

1. Customer `kumbuild.com` pe aaya, examples aur pricing dekhi
2. WhatsApp DM / Instagram DM kiya, ya `/order` pe form bhara
3. Customer ne `account.kumbuild.com` pe signup/login kiya
4. Dus ne details + package confirm kiye, advance 50% ka payment link bheja (Razorpay se)
5. Advance milne ke baad Dus ne order `admin.kumbuild.com/orders` me add kiya — status: Received
6. Dus ne website banayi, status: Preview ready kiya — preview link customer ko WhatsApp pe bheja aur `home.kumbuild.com` pe dikha
7. Customer ne preview dekha (home dashboard ya WhatsApp link se), ek revision bola (WhatsApp pe)
8. Revision ke baad approve kiya, baaki payment kiya
9. Website live — live link customer ko WhatsApp pe bheja aur `home.kumbuild.com` pe dikha, status: Live
10. Agle saal renewal ka reminder aayega (TBD)

## DNS

Cloudflare dashboard me (user khud karega, assistant account nahi chhedega):

| Record | Type | Value / target |
|---|---|---|
| `kumbuild.com` | A / CNAME | Web wala Pages project (Astro, `kumbuild-web`) |
| `account.kumbuild.com` | CNAME | Pages project `kumbuild-account` |
| `admin.kumbuild.com` | CNAME | Pages project `kumbuild-admin` |
| `home.kumbuild.com` | CNAME | Pages project `kumbuild-home` |
| `blog.kumbuild.com` | CNAME | Pages project `kumbuild-blog` |
| `docs.kumbuild.com` | CNAME | Pages project `kumbuild-docs` |
| `www` | CNAME | `kumbuild.com` (redirect ke liye) |

Har subdomain apne Pages project pe jata hai (2026-11-11). Purana plan (wildcard `*.kumbuild.com` → ek hi `kumbuild-app` project) superseded hai — wildcard abhi bhi lag sakta hai, par har subdomain ko apne project se jodna hoga.

## Local development

Har app apne port pe chalta hai (subdomain ki zaroorat nahi hai):

- **Web:** `pnpm dev:web` → `http://localhost:4321`
- **Account:** `pnpm dev:account` → `http://localhost:5173`
- **Admin:** `pnpm dev:admin` → `http://localhost:5174`
- **Home:** `pnpm dev:home` → `http://localhost:5175`
- **Blog:** `pnpm dev:blog` → `http://localhost:4322`
- **Docs:** `pnpm dev:docs` → `http://localhost:4323`
- **Legacy Next.js app:** `pnpm dev:app` → `http://localhost:3000`

Cross-app login redirect dev me `.env.development` se set hota hai (`VITE_ACCOUNT_URL` / `VITE_ADMIN_URL` / `VITE_HOME_URL` — localhost ports; production me subdomains).
