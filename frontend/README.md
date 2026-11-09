# Kumbuild Frontend — Monorepo (plan stage, code abhi nahi likhna)

```
frontend/
  apps/
    web/        kumbuild.com — Astro + React islands (landing, pricing, services, examples, order, FAQ)
    app/        auth + home + admin — ONE Next.js App Router app (subdomain middleware routing)
  packages/
    ui/         shared components + Tailwind tokens
    config/     shared tsconfig / eslint / tailwind
    lib/        shared types + mock data + api-client (backend aane pe sirf base URL badlega)
```

- Tooling (locked): pnpm workspaces + Turborepo, TypeScript, Tailwind CSS, React 19
- Deploy: GitHub Actions -> Cloudflare Pages (web: `wrangler pages deploy dist`; app: `@opennextjs/cloudflare` build -> `wrangler deploy`)
- Frontend pehle mock data se complete hoga, backend baad me aayega.
