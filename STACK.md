# Kumbuild — Tech Stack

Status: **LOCKED (2026-11-09) — jo lock hai wahi likha hai, baaki TBD hai.**
Detail architecture `ARCHITECTURE.md` me hai. Ye file stack ka ek jagah summary hai.

## Stack ek nazar me

| Layer | Choice | Status |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | LOCKED |
| Language | TypeScript (strict) | LOCKED |
| Public site | Astro + React islands | LOCKED |
| App (auth/home/admin) | Next.js App Router + React 19 | LOCKED |
| Styling | Tailwind CSS | LOCKED |
| Shared UI | `packages/ui` | LOCKED (structure) |
| Shared config | `packages/config` | LOCKED (structure) |
| Shared lib | `packages/lib` (types + mock data + api-client) | LOCKED (structure) |
| Deploy (web) | Cloudflare Pages via GitHub Actions | LOCKED |
| Deploy (app) | Cloudflare via `@opennextjs/cloudflare` | LOCKED |
| CI/CD | GitHub Actions | LOCKED |
| DNS / domains | Cloudflare | LOCKED |
| Backend | TBD — frontend ke baad decide hoga | TBD |
| Database | TBD | TBD |
| Payment provider | Razorpay | LOCKED 2026-11-09 |
| Auth provider | TBD (frontend phase me mock) | TBD |

## Kyun ye stack? (Exa-verified, 2026-11-09)

- **Astro (public site):** same marketing site pe Astro ne 14 KB JS bheja, Next.js ne 82 KB; Lighthouse 99 vs 92; INP 90ms vs 210ms. Source: ssg-production.com, 2026-06-18. Marketing pages mostly static hain, isliye Astro best hai.
- **Next.js (app):** dashboard, auth, forms — interactive app ke liye. Subdomain middleware routing Vercel Platforms Starter Kit wala proven pattern hai.
- **Turborepo:** JS/TS-only monorepo task runner, Vercel maintain karta hai. Nx zyada powerful hai (polyglot, distributed CI) par solo builder ke liye heavy hai. Source: nx.dev.
- **Cloudflare:** Creestion / dusrel wala deploy flow pehle se verified hai — GitHub Actions → `wrangler pages deploy dist`. Next.js ke liye `@opennextjs/cloudflare` adapter supported path hai; purana `@cloudflare/next-on-pages` sirf Edge runtime tha. Source: freecodecamp.org, 2026-04-29; blog.blazingcdn.com, 2026-09-18.

## Versions

Exact versions build ke time latest stable se leni hain. Is doc me koi version pin nahi kiya gaya hai, taaki likhte time galat version lock na ho.

## Kya stack me nahi hai

- Koi CMS (WordPress / headless CMS) — nahi hai, websites haath se banengi
- Koi mobile app framework — Kumbuild service me app nahi banta
- Koi alag design system library — shared `packages/ui` hi design system hai

## Local development (plan)

- Monorepo root se Turborepo tasks chalenge (build / dev / lint)
- Localhost pe subdomain test karne ke liye `*.localhost` jaisi trick use hogi — exact setup implementation ke time decide hoga
