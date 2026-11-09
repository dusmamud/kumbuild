# apps/app — auth + home + admin (ONE Next.js App Router app)

Ek hi app, middleware host dekh ke subdomain pe bhejta hai:

- `auth.kumbuild.com` — `/login`, `/signup`, `/forgot-password`, `/verify`
- `home.kumbuild.com` — customer dashboard: `/`, `/orders`, `/orders/[id]`, `/my-website`, `/payments`, `/support`, `/settings`
- `admin.kumbuild.com` — admin dashboard: `/`, `/orders`, `/customers`, `/builds`, `/payments`, `/settings`

Admin alag app NAHI hai — code me `(admin)` route group alag hai, role guard se protected.

Login success -> `home.kumbuild.com`. Bina login ke home/admin -> `auth.kumbuild.com/login`.

Deploy: GitHub Actions -> Cloudflare, `@opennextjs/cloudflare` adapter (`opennextjs-cloudflare build` -> `wrangler deploy`). Normal middleware chalega, Node middleware / `runtime=edge` nahi.

Status: plan stage — code abhi nahi likhna.
