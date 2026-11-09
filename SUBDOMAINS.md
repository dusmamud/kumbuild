# Kumbuild — Subdomain Structure

Status: **LOCKED (2026-11-09, updated same day — customer dashboard hata diya gaya).**

Note: `auth.kumbuild.com` mana gaya hai. User ne ek baar `auth.kumbuilds.com` likha tha — typo assume kiya hai, **confirm pending hai**. Agar `kumbuilds` hi sahi hai to ye poori file badlegi.

## Overview

**Sirf 2 cheezein hain: main landing page aur admin dashboard. Customer ka koi account nahi hai, koi customer dashboard nahi hai, koi signup nahi hai.** Order WhatsApp DM, Instagram DM ya website form se aayega. Jo confirm hoga, admin (Dus) use khud admin dashboard me add karega aur saari progress wahin track karega.

| Subdomain | App | Kaam | Kaun khol sakta hai |
|---|---|---|---|
| `kumbuild.com` | `frontend/apps/web` (Astro) | Public site — landing, pricing, order | Koi bhi, bina login |
| `auth.kumbuild.com` | `frontend/apps/app` (Next.js) | Admin login (sirf Dus) | Koi bhi, bina login — login karne ki jagah hai |
| `admin.kumbuild.com` | `frontend/apps/app` (Next.js) | Admin dashboard | Sirf logged-in admin (Dus) |

`auth` aur `admin` — dono ek hi Next.js app hain. Middleware host dekh ke sahi route group pe bhejta hai. User ko do alag apps lagenge, andar ek hi codebase hai.

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

## 2. auth.kumbuild.com — Admin login (Next.js)

Login nahi chahiye — ye login karne ki jagah hai. **Sirf admin (Dus) login karega. Customer ka yahan koi kaam nahi hai — na signup hai, na customer login.**

| Route | Page | Kya hoga |
|---|---|---|
| `/login` | Admin login | Email + password (sirf admin ka account) |
| `/forgot-password` | Password reset | Reset link / OTP bhejega (backend ke saath, admin ke liye) |

**Login ke baad:** seedha `admin.kumbuild.com` pe bhej do.

**Pehle se logged-in admin auth khole to:** seedha admin dashboard pe bhej do, dobara login page mat dikhao.

## 3. admin.kumbuild.com — Admin dashboard (Next.js)

Sirf logged-in admin (Dus). Bina login ke koi bhi page kholo to `auth.kumbuild.com/login` pe redirect.

| Route | Page | Kya hoga |
|---|---|---|
| `/` | Admin dashboard | Aaj ke orders, pending kaam, revenue summary (draft) |
| `/orders` | Saare orders | Har order, **naya order add karo (confirm hua order yahin add hoga)**, status change karo, customer ko WhatsApp pe update do |
| `/orders/new` | Order add karo | Confirm hue order ki details daalo — customer, package, advance, content |
| `/customers` | Customers | Saare customers, unki websites aur orders |
| `/builds` | Builds | Kaunsi website kis stage pe hai — build / preview / live |
| `/payments` | Payments | Saare payments, advance / final / renewal |
| `/settings` | Admin settings | Admin profile aur settings |

**Order add karna admin ka kaam hai:** WhatsApp DM, Instagram DM ya form se jo order aaye aur confirm ho, admin use yahan add karega. Customer khud kuch add nahi karta — uska koi account hi nahi hai.

## Guards matrix

| Kholne wala | `kumbuild.com` | `auth.kumbuild.com` | `admin.kumbuild.com` |
|---|---|---|---|
| Bina login | ✅ khulega | ✅ khulega | ❌ → login |
| Admin (logged in) | ✅ khulega | → admin | ✅ khulega |

Customer ka koi login nahi hai, isliye customer wali row is matrix me hai hi nahi.

## Redirects

| From | To |
|---|---|
| `www.kumbuild.com/*` | `kumbuild.com/*` (same path) |
| `kumbuild.com/login` (agar koi type kare) | `auth.kumbuild.com/login` |
| `kumbuild.com/dashboard` (agar koi type kare) | `admin.kumbuild.com` |
| `home.kumbuild.com/*` (purana plan — ab nahi hai) | `kumbuild.com` |
| Unknown subdomain, jaise `xyz.kumbuild.com` | `kumbuild.com` |
| Login ke baad `/` (auth pe) | `admin.kumbuild.com` |

## Poora flow — ek order ki kahani

1. Customer `kumbuild.com` pe aaya, examples aur pricing dekhi
2. WhatsApp DM / Instagram DM kiya, ya `/order` pe form bhara
3. Dus ne details + package confirm kiye, advance 50% ka payment link bheja (Razorpay se)
4. Advance milne ke baad Dus ne order `admin.kumbuild.com/orders` me add kiya — status: Received
5. Dus ne website banayi, status: Preview ready kiya, preview link customer ko WhatsApp pe bheja
6. Customer ne preview dekha, ek revision bola (WhatsApp pe)
7. Revision ke baad approve kiya, baaki payment kiya
8. Website live — live link customer ko WhatsApp pe bheja, status: Live
9. Agle saal renewal ka reminder aayega (TBD)

## DNS

Cloudflare dashboard me (user khud karega, assistant account nahi chhedega):

| Record | Type | Value / target |
|---|---|---|
| `kumbuild.com` | A / CNAME | Web wala Pages project (Astro) |
| `*.kumbuild.com` | CNAME | App wala project (Next.js / OpenNext) |
| `www` | CNAME | `kumbuild.com` (redirect ke liye) |

Wildcard `*.kumbuild.com` se `auth` aur `admin` — dono ek hi app project pe jayenge, andar middleware baant dega.

## Local development (plan)

Localhost pe subdomain test karne ke liye `*.localhost` ya `lvh.me` jaisi trick use hoti hai (jaise `auth.localhost`). Exact setup aur port implementation ke time decide hoga — is doc me koi localhost port lock nahi kiya gaya hai.
