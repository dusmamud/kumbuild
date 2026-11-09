# Kumbuild — Subdomain Structure

Status: **LOCKED (2026-11-09).**

Note: `auth.kumbuild.com` mana gaya hai. User ne ek baar `auth.kumbuilds.com` likha tha — typo assume kiya hai, **confirm pending hai**. Agar `kumbuilds` hi sahi hai to ye poori file badlegi.

## Overview

| Subdomain | App | Kaam | Kaun khol sakta hai |
|---|---|---|---|
| `kumbuild.com` | `frontend/apps/web` (Astro) | Public site — landing, pricing, order | Koi bhi, bina login |
| `auth.kumbuild.com` | `frontend/apps/app` (Next.js) | Login / signup | Koi bhi, bina login |
| `home.kumbuild.com` | `frontend/apps/app` (Next.js) | Customer dashboard | Sirf logged-in customer |
| `admin.kumbuild.com` | `frontend/apps/app` (Next.js) | Admin dashboard | Sirf logged-in admin (Dus) |

`auth`, `home` aur `admin` — teenon ek hi Next.js app hain. Middleware host dekh ke sahi route group pe bhejta hai. User ko teen alag apps lagenge, andar ek hi codebase hai.

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
| `/how-it-works` | Kaise kaam karta hai | 5 steps — batao, advance, preview, approve, live |
| `/order` | Order form | Package choose + business details + photos + WhatsApp number |
| `/faq` | FAQ | Aam sawaal — price, time, revision, renewal |
| `/about` | About | Kumbuild kya hai (ABOUT.md wala content, website version) |
| `/contact` | Contact | WhatsApp / email se contact |
| `/privacy` | Privacy policy | Data kaise use hoga |
| `/terms` | Terms | Service ki shartein |

SEO: sirf ye subdomain Google pe index hoga. Har page ka apna title + description hoga.

## 2. auth.kumbuild.com — Login / Signup (Next.js)

Login nahi chahiye — ye login karne ki jagah hai.

| Route | Page | Kya hoga |
|---|---|---|
| `/login` | Login | Email + password (aur Google login — TBD, backend ke saath decide hoga) |
| `/signup` | Signup | Naya account — naam, email, phone, password |
| `/forgot-password` | Password reset | Reset link / OTP bhejega (backend ke saath) |
| `/verify` | Verify | OTP / email verify |

**Login ke baad redirect:**

| Role | Jayega |
|---|---|
| Customer | `home.kumbuild.com` |
| Admin | `admin.kumbuild.com` |

**Pehle se logged-in user auth khole to:** seedha uske dashboard pe bhej do, dobara login page mat dikhao.

## 3. home.kumbuild.com — Customer dashboard (Next.js)

Sirf logged-in customer. Bina login ke koi bhi page kholo to `auth.kumbuild.com/login` pe redirect.

| Route | Page | Kya hoga |
|---|---|---|
| `/` | Dashboard | Mere orders ka summary, current website ka status, aage kya karna hai |
| `/orders` | Mere orders | Saare orders, status ke saath |
| `/orders/[id]` | Order detail | Ek order ki poori detail — package, status, preview link, revisions, payment |
| `/my-website` | Meri website | Live / preview website ka link, details, renewal date |
| `/payments` | Payments | Kitna pay kiya, kitna baaki hai, receipts |
| `/support` | Support | Admin ko message karo, preview pe feedback do |
| `/settings` | Settings | Profile — naam, phone, password change |

## 4. admin.kumbuild.com — Admin dashboard (Next.js)

Sirf logged-in admin (Dus). Customer yahan aa hi nahi sakta.

| Route | Page | Kya hoga |
|---|---|---|
| `/` | Admin dashboard | Aaj ke orders, pending kaam, revenue summary (draft) |
| `/orders` | Saare orders | Har order, status change karo, customer ko message karo |
| `/customers` | Customers | Saare customers, unki websites aur orders |
| `/builds` | Builds | Kaunsi website kis stage pe hai — build / preview / live |
| `/payments` | Payments | Saare payments, advance / final / renewal |
| `/settings` | Admin settings | Admin profile aur settings |

**Guard:** normal customer `admin.kumbuild.com` khole to wapas `home.kumbuild.com` pe bhej do. Bina login ke khole to `auth.kumbuild.com/login` pe bhej do.

## Guards matrix

| Kholne wala | `kumbuild.com` | `auth.kumbuild.com` | `home.kumbuild.com` | `admin.kumbuild.com` |
|---|---|---|---|---|
| Bina login | ✅ khulega | ✅ khulega | ❌ → login | ❌ → login |
| Customer (logged in) | ✅ khulega | → home | ✅ khulega | ❌ → home |
| Admin (logged in) | ✅ khulega | → admin | ✅ khulega* | ✅ khulega |

\* Admin `home.kumbuild.com` khol sakta hai, par uska apna dashboard `admin.kumbuild.com` hai. Frontend phase me admin ko home dikhana ya seedha admin pe bhejna — implementation ke time decide hoga.

## Redirects

| From | To |
|---|---|
| `www.kumbuild.com/*` | `kumbuild.com/*` (same path) |
| `kumbuild.com/login` (agar koi type kare) | `auth.kumbuild.com/login` |
| `kumbuild.com/dashboard` (agar koi type kare) | `home.kumbuild.com` |
| Unknown subdomain, jaise `xyz.kumbuild.com` | `kumbuild.com` |
| Login ke baad `/` (auth pe) | Role ke hisaab se home ya admin |

## Poora flow — ek customer ki kahani

1. `kumbuild.com` pe aaya, examples aur pricing dekhi
2. `/order` pe package choose kiya, form bhara
3. `auth.kumbuild.com/signup` pe account banaya
4. Advance payment kiya (Razorpay se)
5. `home.kumbuild.com` pe order dikhne laga — status: Received
6. Dus ne `admin.kumbuild.com` pe order dekha, website banayi, status: Preview ready kiya
7. Customer ne `home.kumbuild.com/orders/[id]` pe preview dekha, ek revision bola
8. Revision ke baad approve kiya, baaki payment kiya
9. Website live — `home.kumbuild.com/my-website` pe link aa gaya
10. Agle saal renewal ka reminder aayega (TBD)

## DNS

Cloudflare dashboard me (user khud karega, assistant account nahi chhedega):

| Record | Type | Value / target |
|---|---|---|
| `kumbuild.com` | A / CNAME | Web wala Pages project (Astro) |
| `*.kumbuild.com` | CNAME | App wala project (Next.js / OpenNext) |
| `www` | CNAME | `kumbuild.com` (redirect ke liye) |

Wildcard `*.kumbuild.com` se `auth`, `home`, `admin` — teenon ek hi app project pe jayenge, andar middleware baant dega.

## Local development (plan)

Localhost pe subdomain test karne ke liye `*.localhost` ya `lvh.me` jaisi trick use hoti hai (jaise `auth.localhost`). Exact setup aur port implementation ke time decide hoga — is doc me koi localhost port lock nahi kiya gaya hai.
