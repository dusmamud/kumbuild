# apps/web — kumbuild.com (Astro + React)

Public marketing site. Pages: `/`, `/pricing`, `/services`, `/examples`, `/how-it-works`, `/order`, `/faq`, `/about`, `/contact`, `/privacy`, `/terms` — har page 3 locales me: `en-US` (default, no prefix), `/hi/`, `/bn/`.

Astro by default zero JS bhejta hai — sirf interactive jagah React island (`client:*`): order form (`OrderForm.tsx`) aur FAQ accordion (`FaqAccordion.tsx`).

Theme: Option A Trust Blue, light only (THEME.md). Tokens `src/styles/theme.css` + `@kumbuild/config`.

Content: shared dictionaries `packages/lib/src/i18n/*.json` (en-US/hi/bn) — yahin se saare strings aate hain. Order form abhi mock hai — submit par kuch send nahi hota, sirf local confirmation + reference dikhta hai (backend Phase 4 me).

Deploy: GitHub Actions -> Cloudflare Pages (`wrangler pages deploy dist`).

Scripts: `pnpm dev` (port 4321), `pnpm build`, `pnpm preview` — ya root se `pnpm dev:web` / `pnpm build:web`.

Status: scaffold + landing complete (2026-11-09). Prices/content draft hain (PRICING.md/FAQ.md).
