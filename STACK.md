# Kumbuild — Tech Stack

Status: **LOCKED (2026-11-09) — 2026-11-11 ko 6-app plan se updated. Jo lock hai wahi likha hai, baaki TBD hai.**
Detail architecture `ARCHITECTURE.md` me hai. Ye file stack ka ek jagah summary hai.

## Stack ek nazar me

| Layer | Choice | Status |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | LOCKED |
| Language | TypeScript (strict) | LOCKED |
| Public site | Astro + React islands | LOCKED |
| Account app | React 19 + Vite 6 + React Router + TanStack Query | LOCKED (2026-11-11) |
| Admin app | React 19 + Vite 6 + React Router + TanStack Query | LOCKED (2026-11-11) |
| Customer app | React 19 + Vite 6 + React Router + TanStack Query | LOCKED (2026-11-11) |
| Blog app | Astro 7 + Tailwind v4 — `apps/blog` (blog.kumbuild.com) | User ne banaya (2026-11-11) |
| Docs app | Astro 7 + Starlight + Tailwind v4 — `apps/docs` (docs.kumbuild.com) | User ne banaya (2026-11-11) |
| Legacy app | Next.js App Router + React 19 (STATIC export) — `apps/app` | LEGACY — abhi live, naye features nahi |
| Styling | Tailwind CSS v4 | LOCKED |
| Shared UI | `packages/ui` | LOCKED (structure — abhi khaali hai) |
| Shared config | `packages/config` | LOCKED (structure) |
| Shared lib | `packages/lib` (types + i18n dicts + mock data + mock auth + api-client) | LOCKED (structure) |
| Deploy (web) | Cloudflare Pages via GitHub Actions | LOCKED |
| Deploy (account/admin/home) | Cloudflare Pages via GitHub Actions (static `dist/`) | LOCKED (2026-11-11) |
| Deploy (blog/docs) | Cloudflare Pages via GitHub Actions (static `dist/`) | User ne banaya (2026-11-11) |
| Deploy (legacy app) | Cloudflare Pages via GitHub Actions (static export) | LEGACY |
| Deploy (backend) | Oracle VPS via GitHub Actions | LOCKED (2026-11-11) |
| CI/CD | GitHub Actions | LOCKED |
| DNS / domains | Cloudflare | LOCKED |
| Backend | Go — `api.kumbuild.com`, Oracle VPS pe host, deploy GitHub Actions se | LOCKED (2026-11-11) |
| Database | PostgreSQL — Oracle VPS pe hi (same box) | LOCKED (2026-11-11) |
| Payment provider | Razorpay | LOCKED 2026-11-09 |
| Auth provider | TBD (frontend phase me mock — localStorage + demo handoff) | TBD |

## Kyun ye stack? (Exa-verified, 2026-11-09 + 2026-11-11)

- **Astro (public site):** same marketing site pe Astro ne 14 KB JS bheja, Next.js ne 82 KB; Lighthouse 99 vs 92; INP 90ms vs 210ms. Source: ssg-production.com, 2026-06-18. Marketing pages mostly static hain, isliye Astro best hai.
- **React + Vite (account/admin/home):** teeno apps login ke peeche hain (SEO nahi chahiye), sirf static deploy chahiye, aur backend non-JS (Go) hoga — isliye Vite SPA sahi hai, Next.js ka SSR/server extra hai. Sources (Exa, 2026-11-11): ASoc 2026-06-30 ("Choose React with Vite when the dashboard is a pure client for an API you already run, especially if that API is not JavaScript"), devcerts, WebVerse Arena 2025-04-08. **Static** (`vite build` → `dist/`) — Cloudflare Pages pe host hota hai, koi Worker nahi.
- **Next.js (legacy app only):** purana admin app static export (`output: "export"`) pe tha — Cloudflare Pages pe host hota hai, koi Worker nahi (user decision 2026-11-09). Naye apps me Next.js nahi hai.
- **Turborepo:** JS/TS-only monorepo task runner, Vercel maintain karta hai. Nx zyada powerful hai (polyglot, distributed CI) par solo builder ke liye heavy hai. Source: nx.dev.
- **Cloudflare:** Creestion / dusrel wala deploy flow pehle se verified hai — GitHub Actions → `wrangler pages deploy`. Chhe apps static hain (Astro `dist/` × 3 — web/blog/docs, Vite `dist/` × 3, legacy Next.js `out/`).

## Versions

Astro 5, React 19, Vite 6, Tailwind v4 — ye versions build me use hui hain (2026-11-11).

## Kya stack me nahi hai

- Koi CMS (WordPress / headless CMS) — nahi hai, websites haath se banengi
- Koi mobile app framework — Kumbuild service me app nahi banta
- Koi alag design system library — shared `packages/ui` hi design system hai (abhi khaali hai; Vite apps landing wali `theme.css` tokens share karte hain)

## Local development

- Monorepo root se Turborepo tasks chalenge (build / dev / lint)
- Dev ports: web 4321, account 5173, admin 5174, home 5175 (preview 4173/4174/4175); legacy Next.js app 3000
- Localhost pe apps alag ports pe chalte hain — cross-app login redirect `.env.development` me `VITE_ACCOUNT_URL` / `VITE_ADMIN_URL` / `VITE_HOME_URL` se set hota hai (production me subdomains)
