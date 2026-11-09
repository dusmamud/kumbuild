# THEME.md — Kumbuild theme, color grading aur locales

> **Status (2026-11-09): LOCKED.** Theme Option A "Trust Blue" user ne apply karne ko bola — best option assistant ne chuna (user: "aap best theme apply karo"). Astro sirf light theme me hoga. Next.js app me system / light / dark hoga. Shuru me 3 locales: English (US) default, Hindi, Bengali.
>
> Ye doc plan hai — code abhi nahi likha gaya. Jab frontend bane, tokens yahin se lene hain, dobara decide nahi karne.

## 1. Locked decisions

| Decision | Kya lock hua |
|---|---|
| Theme | **Option A — Trust Blue** (4 options me se best, assistant pick, user approved apply karne ko) |
| Primary colour | Logo wala hi: **#008EFD** — har jagah, dono apps me |
| Astro (`apps/web`, kumbuild.com) | **Sirf light theme.** Pure white professional. Koi dark mode nahi, koi theme toggle nahi, `prefers-color-scheme` ko ignore karo. |
| Next.js (`apps/app` — auth / home / admin) | **System / light / dark.** Default = system (device ki setting). User light ya dark choose kar sakta hai, choice save hoti hai. |
| Locales (shuru me) | **3: `en-US` (default), `hi` (Hindi), `bn` (Bengali).** Baad me aur add ho sakte hain, par URL structure abhi se final hai — launch ke baad badalna matlab redirects + SEO loss. |
| Shared strings | Ek hi source of truth — dono apps wahi dictionaries use karenge (Section 6). |

## 2. Primary colour scale

Primary logo wala `#008EFD` hai. Scale white/black mix se bana hai (verified values):

| Token | Hex | Use |
|---|---|---|
| `blue-50` | #EBF6FF | Light tint — info background, selected row, badge bg |
| `blue-100` | #CCE8FF | Hover tint, light border on blue surfaces |
| `blue-200` | #99D2FE | Decorative tint, progress track |
| `blue-300` | #66BBFE | — (scale complete karne ke liye) |
| `blue-400` | #33A5FD | Dark mode me primary hover / light blue text on dark |
| `blue-500` | **#008EFD** | **Primary — buttons, links (bade/bold), active states, logo** |
| `blue-600` | #0079D7 | Primary button hover, focus ring |
| `blue-700` | #0063B1 | **Text links aur chhoti text — primary par nahi** |
| `blue-800` | #00477E | Pressed state, dark blue text on light tint |
| `blue-900` | #002B4C | Darkest blue — sirf text ya deep accents ke liye |

### Contrast rule — isko todna mana hai

White text `#008EFD` par **3.34:1** contrast deta hai. Ye button jaisi badi/bold text ke liye theek hai (3:1 chahiye), par chhoti body text ke liye nahi (4.5:1 chahiye).

- **Primary button:** `#008EFD` bg + **bold** white text. Hover: `#0079D7`.
- **Text link / chhoti blue text:** `#0063B1` (white par 6.14:1). Kabhi bhi chhoti text ko `#008EFD` me mat likho.
- **Dark mode me link:** `#33A5FD` (dark bg par readable hai).
- **Focus ring:** `#0079D7`, 2px outline, button/input par hamesha dikhna chahiye.

## 3. Light theme tokens (Astro + Next.js light)

Astro sirf yehi tokens use karega. Next.js light mode bhi yehi.

| Token (CSS var) | Value | Kahan use hoga |
|---|---|---|
| `--bg` | #FFFFFF | Page background — pure white, koi tint nahi |
| `--surface` | #F8FAFC | Cards, table header, light section bg |
| `--surface-hover` | #F1F5F9 | Hover on rows / list items |
| `--border` | #E2E8F0 | Card border, divider, input border |
| `--border-strong` | #CBD5E1 | Input border on focus/hover, table border |
| `--text-heading` | #0F172A | H1–H3, nav logo text, card titles |
| `--text-body` | #334155 | Paragraph, list, form labels |
| `--text-muted` | #64748B | Helper text, captions, footer, timestamps |
| `--text-on-primary` | #FFFFFF | Primary button text (bold hi rakhna) |
| `--primary` | #008EFD | CTA button, active nav, links (bade/bold) |
| `--primary-hover` | #0079D7 | Button hover |
| `--primary-text` | #0063B1 | Text links, chhoti blue text |
| `--primary-tint` | #EBF6FF | Info bg, badge bg, selected state |

### Semantic colours (light + dark dono me same)

| Token | Value | Use |
|---|---|---|
| `--success` | #16A34A | Order delivered, payment success, live status |
| `--success-bg` | #F0FDF4 | Success message background |
| `--warning` | #D97706 | Pending, action needed, renewal due |
| `--warning-bg` | #FFFBEB | Warning message background |
| `--error` | #DC2626 | Form error, payment failed, destructive action |
| `--error-bg` | #FEF2F2 | Error message background |
| `--info` | #0284C7 | Info message (blue family, primary se alag shade) |

## 4. Dark theme tokens (sirf Next.js app)

Astro me ye tokens exist hi nahi karenge — kumbuild.com par dark CSS likhna bhi mana hai.

| Token (CSS var) | Value | Kahan use hoga |
|---|---|---|
| `--bg` | #0F172A | Page background |
| `--surface` | #1E293B | Cards, panels, dropdown |
| `--surface-hover` | #283449 | Hover on rows / list items (approx — token file me exact rakho) |
| `--border` | #334155 | Card border, divider, input border |
| `--border-strong` | #475569 | Input border on focus/hover |
| `--text-heading` | #F1F5F9 | H1–H3, card titles |
| `--text-body` | #CBD5E1 | Paragraph, list |
| `--text-muted` | #94A3B8 | Helper text, captions |
| `--text-on-primary` | #FFFFFF | Primary button text (bold) |
| `--primary` | #008EFD | CTA button, active nav — light jaisa hi |
| `--primary-hover` | #33A5FD | Button hover (dark par halka blue zyada dikhta hai) |
| `--primary-text` | #33A5FD | Text links on dark bg |
| `--primary-tint` | #1E293B | Info bg on dark (surface jaisa, alag tint nahi) |

Semantic dark: `--success` #4ADE80 (text/icons ke liye halka green), `--warning` #FBBF24, `--error` #F87171, `--info` #38BDF8. Background tints dark me surface se alag nahi hote — text/icon colour se samjhana hai, bg tint se nahi.

## 5. Theme behaviour — kaise kaam karega

### Astro (`apps/web`) — light only

- Sirf Section 3 ke tokens. Koi `data-theme`, koi dark media query, koi toggle button nahi.
- `prefers-color-scheme: dark` wale visitor ko bhi light site dikhegi — ye decision hai, bug nahi.
- Logo: `kumbuild-logo.svg` (transparent, blue mark) header/footer me. Dark section kabhi nahi banega, isliye blue-bg logo version ki zaroorat nahi padegi — phir bhi wo file repo me hai, future ke liye.

### Next.js (`apps/app`) — system / light / dark

- **Default = system.** Pehli visit par device ki `prefers-color-scheme` follow karo.
- **Toggle:** header/settings me 3 options — System / Light / Dark. User ki choice **cookie** me save karo (localStorage nahi — cookie se server bhi theme jaan sakta hai, SSR par flash nahi hoga).
- **No-flash rule:** `<head>` me chhota inline script — paint se pehle cookie/system padh ke `data-theme` attribute set karo. Bina iske page pehle light dikhega phir dark hoga — wo flash mana hai.
- **CSS variables:** dono themes ke tokens `:root` (light) aur `[data-theme="dark"]` me same variable names se. Component kabhi hard-coded colour nahi likhega — hamesha `var(--bg)` jaisa token use karega.
- **Logo in app:** header me `kumbuild-logo.svg` light mode me; dark mode me bhi wahi (blue mark dark bg par readable hai — #008EFD on #0F172A contrast 5.61:1 hai). Blue-bg version sirf tab use karo jab logo ko square tile me dikhana ho (jaise app icon / avatar).

### Dono apps me common rules

- **Border radius:** cards 12px, buttons 8px, inputs 8px, badges pill. (Logo ke corner radius se match karne ke liye — gol, par zyada gol nahi.)
- **Shadow:** light me halki — card `0 1px 2px rgba(15,23,42,.06)`. Dark me shadow nahi, border se separation.
- **Font:** Poppins **nahi** — wo ShrinkIt ka font hai, Kumbuild ka nahi. Kumbuild font: system stack + Inter (Latin) — final font build ke time lock hoga, is doc me font decide nahi hua. Devanagari/Bengali ke liye Section 6.3 dekho.

## 6. Locales — shared i18n

### 6.1 Locales aur URL structure (LOCKED)

| Locale | Language | URL | Notes |
|---|---|---|---|
| `en-US` | English (US) | `kumbuild.com/` — **koi prefix nahi** (default) | Default locale. Har page pehle English me banega. |
| `hi` | Hindi (हिन्दी) | `kumbuild.com/hi/` | Devanagari script. |
| `bn` | Bengali (বাংলা) | `kumbuild.com/bn/` | Bengali script. |

- **URL structure: subfolders** (`/hi/`, `/bn/`) — Exa-verified web practice: ek domain, ek deploy, SEO ke liye sabse simple. Subdomain ya alag domain nahi.
- **Default locale ka prefix nahi:** English URLs `/pricing/` jaise rahenge, `/en-US/pricing/` nahi. Ye launch se pehle final hai — baad me badla to har URL redirect karna padega.
- **Slugs translate nahi honge (shuru me):** `/hi/pricing/` — slug English hi rahega, sirf content Hindi me. Translated slugs SEO ke liye behtar hote hain par routing complexity badhate hain; chhoti site ke liye same slug hi sahi hai. Baad me decide karke badla ja sakta hai.
- **Language switcher:** header me hamesha dikhega (EN | हिंदी | বাংলা). Switch karne par **wahi page** dusri locale me khulega — home par wapas nahi bhejna.

### 6.2 Dono apps me ek hi setup

**Astro (`apps/web`) — built-in i18n routing** (source: docs.astro.build/en/guides/internationalization/):

```js
// astro.config.mjs
i18n: {
  locales: [
    { path: "hi", codes: ["hi"] },
    { path: "bn", codes: ["bn"] },
    { path: "en-US", codes: ["en-US", "en"] },
  ],
  defaultLocale: "en-US",
  routing: { prefixDefaultLocale: false },
}
```

- Default locale unprefixed, `hi`/`bn` prefixed. Links banate time `getRelativeLocaleUrl()` use karo — hard-coded `/hi/...` links mat likho.
- `redirectToDefaultLocale` **false** rakho — `/` par English site khulegi, redirect nahi hoga.

**Next.js (`apps/app`) — `next-intl` + `[locale]` segment** (source: next-intl.dev/docs/routing/configuration):

```ts
// i18n/routing.ts
export const routing = defineRouting({
  locales: ["en-US", "hi", "bn"],
  defaultLocale: "en-US",
  localePrefix: "as-needed", // default unprefixed, baaki prefixed
});
```

- App Router me Next.js ka purana built-in `i18n` config **kaam nahi karta** (wo Pages Router ka tha) — isliye `next-intl` use hoga, middleware locale detect karega.
- **Detection priority (LOCKED):** 1) URL me locale, 2) user ki saved choice (cookie), 3) `Accept-Language` header (pehli visit), 4) default `en-US`. URL hamesha jeetega — cookie se redirect loop nahi banana.
- **Middleware matcher:** `/api`, `/_next`, static files ko locale redirect se bahar rakho — warna images/API 404 honge.

### 6.3 Shared dictionaries — ek source of truth

- Strings **ek jagah** rahenge: `frontend/packages/lib/src/i18n/` — `en-US.json`, `hi.json`, `bn.json`. Dono apps (Astro + Next.js) wahi files import karenge. Kisi bhi app me apni copy nahi banegi — copy bani to dono drift karenge.
- **Keys namespaced** honge: `nav.pricing`, `pricing.business.title`, `order.form.name.label` — flat keys nahi.
- **Plurals / variables ICU MessageFormat se:** `{count, plural, one {# page} other {# pages}}` — Hindi/Bengali me plural rules English se alag hote hain, hard-coded `s` mat lagao.
- **Missing key rule:** koi key kisi locale me missing ho to **en-US dikhega + build/dev me warning log hoga**. Missing page par 404 nahi — fallback English content dikhega (Astro `fallback` / next-intl me same rule). Par **hreflang/sitemap me wo locale list nahi hoga** jab tak asli translation na ho (Section 6.4).
- **Translation workflow:** user (Dus) ya translator JSON edit karega — code change nahi. Har PR me check: har key teeno locales me hai ya fallback list me hai.

### 6.4 SEO — hreflang, canonical, sitemap

- **hreflang reciprocity:** har page har locale ko refer karega, khud ko bhi. Ek taraf ka link Google poora set discard kar deta hai. Ye ek shared helper se generate hoga — haath se per-page mat likho.
- **Absolute URLs:** hreflang me `https://kumbuild.com/hi/pricing/` — relative URL Google ignore karta hai.
- **`x-default`:** `https://kumbuild.com/` (English default) par point karega.
- **Canonical:** har locale page ka canonical **khud** hoga — Hindi page ko English par canonicalize mat karo, warna Google Hindi URL ignore kar dega.
- **Sitemap:** har locale ke liye alag URLs, sirf wo pages jo us locale me actually exist karte hain (fallback English wale pages list nahi honge).
- **`<html lang>`:** har page par sahi — `en-US`, `hi`, `bn`. Bina iske screen reader galat pronunciation karega.

### 6.5 Fonts, numbers, dates

- **Fonts:** Latin ke liye Inter/system stack. **Hindi ke liye Noto Sans Devanagari, Bengali ke liye Noto Sans Bengali** — Poppins me Bengali glyphs nahi hote, isliye wo use nahi hoga. Fonts `unicode-range` se load honge taaki English visitor ko Devanagari font download na karna pade.
- **Numbers / currency:** `Intl.NumberFormat(locale)` use karo. **Paise hamesha Indian grouping me:** `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })` — chahe UI locale koi bhi ho, ₹7,999 aise hi dikhega (US grouping `100,000` nahi, Indian `1,00,000`).
- **Dates:** `Intl.DateTimeFormat(locale)` — Hindi me date Hindi format me, English me US format me.
- **Text expansion:** Hindi/Bengali text English se ~20–30% lamba hota hai — buttons/cards me fixed height mat rakho, wrap hone do.

## 7. Tokens kahan rahenge (code banate time)

- Shared tokens: `frontend/packages/config/theme.ts` — dono apps wahi import karenge.
- Astro: `apps/web/src/styles/theme.css` (sirf light tokens).
- Next.js: `apps/app/src/app/globals.css` — `:root` light + `[data-theme="dark"]` dark.
- Dictionaries: `frontend/packages/lib/src/i18n/*.json` (Section 6.3).
- Ye file locations plan hain — code abhi nahi likha gaya.

## 8. Sources — Exa se verify (2026-11-09)

- Astro i18n routing: locales + defaultLocale + `prefixDefaultLocale` (false = default unprefixed), `getRelativeLocaleUrl()`, fallback strategies. Source: docs.astro.build/en/guides/internationalization/; getastrothemes.com/blog/astro-multilingual-website-guide/ (2026-10-12).
- Next.js App Router i18n: built-in `i18n` config App Router me kaam nahi karta; `[locale]` segment + next-intl middleware; `localePrefix: "as-needed"` vs `"always"`. Source: next-intl.dev/docs/routing/configuration; pagepro.co (2026-11-05); webtranslateit.com (2026-08-13).
- hreflang: reciprocity zaroori, absolute URLs, sirf existing locales, `x-default` default locale par. Source: olafboettcher.de/blog/multilingual-nextjs-hreflang (2026-09-09).
- Contrast ratios khud calculate kiye gaye hain (WCAG formula): white on #008EFD = 3.34:1, white on #0063B1 = 6.14:1, #008EFD on #0F172A = 5.61:1.
- Palette Option A: 2026-11-09 ko 4 options me se assistant pick — user ne "best theme apply karo" bola.
