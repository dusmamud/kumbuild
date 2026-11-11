# THEME.md — Kumbuild theme, color grading aur locales

> **Status (2026-11-11): UPDATED to v2.** Theme Option A "Trust Blue" user ne apply karne ko bola — best option
> assistant ne chuna (user: "aap best theme apply karo"). **Sab apps sirf light theme me honge — koi dark mode nahi**
> (user ko dark pasand nahi, 2026-11-10). Shuru me 3 locales: English (US) default, Hindi, Bengali.
>
> **Source of truth (2026-11-11 rewrite):** web app ka theme likha ja chuka hai — ye doc ab plan nahi, uska record
> hai. Light theme ke liye source of truth **`frontend/apps/web/src/styles/theme.css` (v2 warm paper,
> BLUEPRINT 2026-11-10)** hai. Neeche §2–§3–§5 ki values wahi se li gayi hain (khud verify ki gayi). **Purana v1
> (slate — pure white #FFFFFF, slate text) ab nahi chalta.** `frontend/packages/config/theme.ts` ke color tokens
> (BLUE/LIGHT) ko **koi app value ke roop me import nahi karta** — sirf `Locale` type aur web me `localePath`
> use hote hain (verify kiya) — wo v1 values rakhta hai aur source of truth **nahi** hai (drift §9 me).

## 1. Locked decisions

| Decision | Kya lock hua |
|---|---|
| Theme | **Option A — Trust Blue** (4 options me se best, assistant pick, user approved apply karne ko) |
| Primary colour | Logo wala hi: **#008EFD** — har jagah, sab apps me (v1 se v2 me nahi badla) |
| Astro (`apps/web`, kumbuild.com) | **Sirf light theme — warm paper** (`--bg #FAF9F6`, pure white nahi). Koi dark mode nahi, koi theme toggle nahi, `prefers-color-scheme` ko ignore karo. |
| Vite apps (`apps/account`, `apps/admin`, `apps/home`) | **Sirf light theme** — landing wali `theme.css` tokens hi use karte hain (copy — `src/index.css`). Koi dark mode nahi, koi theme toggle nahi. (2026-11-11 — note: copies me abhi bhi pre-fix reveal rule hai, §9 dekho.) |
| Legacy Next.js (`apps/app` — auth / home / admin) | **System / light / dark tha.** Default = system (device ki setting). User light ya dark choose kar sakta tha, choice save hoti thi. **Ye app LEGACY hai — naye apps me dark mode nahi hai.** |
| Locales (shuru me) | **3: `en-US` (default), `hi` (Hindi), `bn` (Bengali).** Baad me aur add ho sakte hain, par URL structure abhi se final hai — launch ke baad badalna matlab redirects + SEO loss. |
| Shared strings | Ek hi source of truth — sab apps wahi dictionaries use karenge (Section 6). Vite apps abhi English-only hain (locale plumbing scaffolded hai) — app pages ki full i18n baad me hogi. |

## 2. Primary colour scale (v2 — `theme.css` se, verify kiya)

Primary logo wala `#008EFD` hai. Coded scale (`--color-primary-*`, Tailwind `@theme`):

| Token | Hex | Use |
|---|---|---|
| `primary-50` | #E8F3FE | Light tint — info background, selected row, badge bg, text selection bg |
| `primary-100` | #CCE4FD | Hover tint, light border on blue surfaces |
| `primary-200` | #99C9FB | Decorative tint, progress track |
| `primary-300` | #66ADF9 | — (scale complete karne ke liye) |
| `primary-400` | #3392F6 | (Legacy dark mode me primary hover / light blue text on dark — naye apps me use nahi hota) |
| `primary-500` | **#008EFD** | **Primary — buttons, links (bade/bold), active states, logo, focus ring** |
| `primary-600` | #0072C8 | Primary button hover |
| `primary-700` | #0069C7 | **Text links aur chhoti text — primary par nahi** |
| `primary-800` | #004E8F | Pressed state, dark blue text on light tint |
| `primary-900` | #00325C | Darkest blue — sirf text ya deep accents ke liye |

### Contrast rule — isko todna mana hai (ratios khud WCAG formula se calculate kiye, 2026-11-11)

White text `#008EFD` par **3.34:1** contrast deta hai. Ye button jaisi badi/bold text ke liye theek hai (3:1 chahiye), par chhoti body text ke liye nahi (4.5:1 chahiye).

- **Primary button:** `#008EFD` bg + **bold** white text. Hover: `#0072C8` (white par 4.95:1).
- **CTA accent (orange) — 2026-11-11, user ne "contrasting color try karo" bola:** order/submit buttons (hero, header, pricing tiers, order form, final CTA) **blue nahi, orange** `#C2410C` bg + white text (5.18:1, AA pass), hover `#9A3412`. Blue page ka complement hai — CTA pop karta hai. Brand blue links, badges ("Most chosen"), focus rings aur accents me hi rehta hai. Token: `--color-cta` / `--color-cta-hover` (theme.css).
- **Text link / chhoti blue text:** `#0069C7` (white par 5.46:1, paper `#FAF9F6` par 5.19:1). Kabhi bhi chhoti text ko `#008EFD` me mat likho — paper par sirf 3.17:1 hai. (Purana v1 text-blue `#0063B1` web `theme.css` me nahi hai — sirf legacy `globals.css` aur `theme.ts` me hai — web ke liye use mat karo.)
- **Dark mode me link (LEGACY only):** `#33A5FD` (dark bg par readable hai) — naye apps me dark mode hai hi nahi.
- **Focus ring:** `#008EFD`, 2px outline, offset 2px, radius 4px (`theme.css` `:focus-visible`) — button/input par hamesha dikhna chahiye. (Purana v1 ring `#0072C8` ab focus ring nahi hai — coded ring `#008EFD` hai; `#0072C8` primary-600 ke roop me exist karta hai.)

## 3. Light theme tokens (v2 warm paper — `theme.css` se, verify kiya)

Web app ke `:root` vars (yehi 6 hain — purane v1 vars `--surface-hover`, `--border-strong`, `--text-on-primary`,
`--primary`, `--primary-hover`, `--primary-text`, `--primary-tint` `:root` vars ke roop me **exist nahi karte**;
unke equivalents Tailwind `--color-primary-*` tokens hain, §2 dekho):

| Token (CSS var) | Value | Kahan use hoga |
|---|---|---|
| `--bg` | #FAF9F6 | Page background — warm paper, pure white nahi |
| `--surface` | #F3F1EC | Cards, table header, light section bg |
| `--border` | #E7E2D9 | Card border, divider, input border |
| `--text-heading` | #1C1917 | H1–H3, nav logo text, card titles (paper par 16.61:1) |
| `--text-body` | #44403C | Paragraph, list, form labels (paper par 9.76:1) |
| `--text-muted` | #6F675E | Helper text, captions, footer, timestamps (paper par 5.28:1) |

Warm neutrals (`@theme` — Tailwind utilities ke naam):

| Token | Value | Use |
|---|---|---|
| `--color-ink` | #1C1917 | Heading/ink text (same as `--text-heading`) |
| `--color-body` | #44403C | Body text (same as `--text-body`) |
| `--color-muted` | #6F675E | Muted text (same as `--text-muted`) |
| `--color-faint` | #A8A29E | Faint text, scrollbar hover, disabled hints |
| `--color-surface` | #F3F1EC | Surface (same as `--surface`) |
| `--color-paper` | #FAF9F6 | Page bg (same as `--bg`) |
| `--color-line` | #E7E2D9 | Borders/dividers (same as `--border`) |

### Semantic colours (v2 — coded names, toned into the palette)

| Token | Value | Use |
|---|---|---|
| `--color-live` | #15803D | Order delivered, payment success, live status (soft bg: `--color-live-soft` #E6F5EC) |
| `--color-warn` | #D97706 | Pending, action needed, renewal due (v1 `--warning` wahi value, naya naam) |
| `--color-danger` | #DC2626 | Form error, payment failed, destructive action (v1 `--error` wahi value, naya naam) |
| `--color-star` | #D97706 | Rating stars (soft bg: `--color-star-soft` #FEF3C7) |

**Web `theme.css` me nahi hain:** `--success-bg` (`#F0FDF4`), `--warning-bg` (`#FFFBEB`), `--error-bg` (`#FEF2F2`) —
ye values kahin code me nahi hain; `--info` (`#0284C7`) sirf legacy `globals.css` aur `theme.ts` me hai, web me nahi.
Naya semantic bg chahiye to pehle token banao, hard-coded hex mat likho.

## 4. Dark theme tokens (LEGACY — sirf purana Next.js app)

**Naye apps (Astro + Vite) me dark mode nahi hai — ye tokens sirf legacy `apps/app` ke liye the.** Astro me ye tokens exist hi nahi karte — kumbuild.com par dark CSS likhna bhi mana hai.

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

## 5. Theme behaviour — kaise kaam karta hai (v2, coded)

### Astro (`apps/web`) — light only

- Sirf Section 3 ke tokens. Koi `data-theme`, koi dark media query, koi toggle button nahi.
- `prefers-color-scheme: dark` wale visitor ko bhi light site dikhegi — ye decision hai, bug nahi.
- Logo: `kumbuild-logo.svg` (transparent, blue mark) header/footer me. Blue-bg logo version (`public/logo/kumbuild-logo-blue-bg.png` + `.svg`) repo me hai — square tile (app icon / avatar) ke liye.
- **Scroll reveal (2026-11-11 fix):** content default visible hai. Sirf jab JS proven present ho (`<head>` inline script `html` par `.js` class lagata hai, first paint se pehle) tab `[data-reveal]` elements `opacity: 0` + `translateY(16px)` se start hote hain; observer `.is-in` lagata hai (0.7s, ease `cubic-bezier(0.22, 1, 0.36, 1)`). JS band ho to hidden state kabhi apply nahi hota — `<noscript>` fallback bhi hai. Ye rule sirf `prefers-reduced-motion: no-preference` me chalta hai.
- **Motion tokens:** `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`; marquee `42s linear infinite` (hover par pause hota hai); live-pulse `2.4s ease-in-out infinite`; hero float `kb-float 7s ease-in-out infinite` (reduced-motion me disabled). **Known gap:** marquee aur live-pulse ka `prefers-reduced-motion` gating abhi bhi nahi hai (§9).

### Vite apps (`apps/account`, `apps/admin`, `apps/home`) — light only

- Landing wali `theme.css` tokens hi use karte hain (copy — `src/index.css`). Koi dark mode, koi toggle, koi `data-theme` nahi.
- Light-only rule Section 3 + contrast rules (Section 2) yahan bhi lagu hote hain.
- **Note:** teen copies ek doosre se byte-identical hain par web `theme.css` se nahi — unme abhi bhi pre-fix reveal rule + galat comment hai (§9). Vite apps me koi `data-reveal` element/observer nahi hai, isliye aaj harmless hai.

### LEGACY — Next.js (`apps/app`) — system / light / dark (tha)

- **Default = system.** Pehli visit par device ki `prefers-color-scheme` follow karo.
- **Toggle:** header/settings me 3 options — System / Light / Dark. User ki choice **cookie** me save karo (localStorage nahi — cookie se server bhi theme jaan sakta hai, SSR par flash nahi hoga).
- **No-flash rule:** `<head>` me chhota inline script — paint se pehle cookie/system padh ke `data-theme` attribute set karo. Bina iske page pehle light dikhega phir dark hoga — wo flash mana hai.
- **CSS variables:** dono themes ke tokens `:root` (light) aur `[data-theme="dark"]` me same variable names se. Component kabhi hard-coded colour nahi likhega — hamesha `var(--bg)` jaisa token use karega.
- **Logo in app:** header me `kumbuild-logo.svg` light mode me; dark mode me bhi wahi (blue mark dark bg par readable hai — #008EFD on #0F172A contrast **5.35:1** hai; purane doc me 5.61:1 galat likha tha, 2026-11-11 ko dobara calculate kiya). Blue-bg version sirf tab use karo jab logo ko square tile me dikhana ho (jaise app icon / avatar).

### Sab apps me common rules (v2, coded)

- **Border radius:** radius tokens code me nahi hain — Tailwind utilities se lagte hain. Coded practice: cards `rounded-2xl` (16px, web src me 44×), buttons/inputs `rounded-xl` (12px, 47×), badges pill. (Purana v1 rule "cards 12px, buttons/inputs 8px" code se match nahi karta.)
- **Shadow:** light me coded main shadow `shadow-[0_20px_40px_-24px_rgba(28,25,23,0.3)]` (web src me 16×) + bade warm shadows. Purana v1 shadow `0 1px 2px rgba(15,23,42,.06)` code me **0 baar** hai. Dark me shadow nahi, border se separation.
- **Font:** Poppins **nahi** — wo ShrinkIt ka font hai, Kumbuild ka nahi. Kumbuild font **LOCKED (2026-11-10, docs-site port): Inter 400;500;600 body, Sora 600;700 headings** (Google Fonts se load hota hai — `Layout.astro:69`). **Sora 800 load nahi hota** (sirf 600;700) — doc se hata diya. Devanagari/Bengali ke liye Section 6.5 dekho. Font stacks: `--font-sans` Inter + Noto Sans Devanagari/Bengali fallback, `--font-display` Sora + Inter + Noto fallback, `--font-mono` system mono stack.

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

### 6.2 Sab apps me ek hi setup

**Astro (`apps/web`) — built-in i18n routing** (source: docs.astro.build/en/guides/internationalization/):

```js
// astro.config.mjs (code se match karta hai — verify kiya)
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

- Default locale unprefixed, `hi`/`bn` prefixed. Links banate time code hand-rolled `localePath` use karta hai (`frontend/packages/config/theme.ts` se, `src/i18n/utils.ts` me `pageUrl`) — Astro ka `getRelativeLocaleUrl()` code me **0 baar** use hota hai; behaviour same hai, sirf helper alag hai.
- `redirectToDefaultLocale` **false** rakho — `/` par English site khulegi, redirect nahi hoga.

**Vite apps (`apps/account`, `apps/admin`, `apps/home`) — URL prefix + shared dicts:**

- Locale URL ke pehle segment se padha jata hai (`/hi/...`, `/bn/...`; en-US bina prefix). Router `basename` se kaam karta hai; `LocaleSwitcher` wahi page dusri locale me kholta hai.
- Dicts wahi shared files hain (`frontend/packages/lib/src/i18n/*.json`).
- **Note (2026-11-11):** 3 Vite apps abhi English-only hain — locale plumbing (`LocaleProvider` + `LocaleSwitcher`) scaffolded hai, page strings English me hain. App pages ki full i18n baad me hogi.

**LEGACY — Next.js (`apps/app`) — `next-intl` + `[locale]` segment** (source: next-intl.dev/docs/routing/configuration):

```ts
// i18n/routing.ts
export const routing = defineRouting({
  locales: ["en-US", "hi", "bn"],
  defaultLocale: "en-US",
  localePrefix: "as-needed", // default unprefixed, baaki prefixed
});
```

- App Router me Next.js ka purana built-in `i18n` config **kaam nahi karta** (wo Pages Router ka tha) — isliye `next-intl` use hoga. **Static export me middleware nahi chalta** (Exa-verified, next-intl docs 2026-11-09): default locale (en-US) root par hai (bina prefix), hi/bn `[locale]/` tree me hain; locale server se negotiate nahi hota.
- **Detection priority (LOCKED):** 1) URL me locale, 2) user ki saved choice (LocaleSwitcher link — client-side), 3) default `en-US`. URL hamesha jeetega — cookie se redirect loop nahi banana. `Accept-Language` header server pe nahi padha jata (koi server hi nahi hai).

### 6.3 Shared dictionaries — ek source of truth

- Strings **ek jagah** rahenge: `frontend/packages/lib/src/i18n/` — `en-US.json`, `hi.json`, `bn.json`. Sab apps (Astro + Vite) wahi files import karenge. Kisi bhi app me apni copy nahi banegi — copy bani to dono drift karenge. (Legacy Next.js app bhi wahi dicts use karta hai — `apps/app/src/i18n/request.ts:3` imports `getDictionary`.)
- **Keys namespaced** honge: `nav.pricing`, `pricing.business.title` jaise — flat keys nahi. (Note: doc ke purane examples `pricing.business.title` / `order.form.name.label` literal keys ke roop me exist nahi karte — order keys namespace ke andar flat hain; structure broad sense me namespaced hai.)
- **Plurals / variables ICU MessageFormat se:** `{count, plural, one {# page} other {# pages}}` — Hindi/Bengali me plural rules English se alag hote hain, hard-coded `s` mat lagao.
- **Missing key rule (as implemented, 2026-11-11):** `getDictionary` sirf **whole-dictionary fallback** karta hai (`?? enUS`) — ek key missing ho to per-key fallback **nahi** hota, aur koi warning log bhi nahi hai. Aaj ye rule test nahi hua kyunki compile-time parity hai (`type Dictionary = typeof enUS` — missing key build error hai) aur aaj saari keys teeno locales me maujood hain. Purana doc rule ("en-US dikhega + warning log hoga") implementation se match nahi karta — ya to per-key fallback implement karo, ya rule ko yahi likha rehne do.
- **Translation workflow:** user (Dus) ya translator JSON edit karega — code change nahi. Har PR me check: har key teeno locales me hai ya fallback list me hai.

### 6.4 SEO — hreflang, canonical, sitemap

**NOT IMPLEMENTED on web (2026-11-11, verify kiya):** `Layout.astro` me `canonical` / `hreflang` / `og:url` / `twitter:*`
ka **ek bhi occurrence nahi** hai, aur `astro.config.mjs` me `@astrojs/sitemap` integration nahi hai. Neeche ke rules
**target hain, current state nahi** — implement karne tak inhe rule mat mano:

- **hreflang reciprocity:** har page har locale ko refer karega, khud ko bhi. Ek taraf ka link Google poora set discard kar deta hai. Ye ek shared helper se generate hoga — haath se per-page mat likho.
- **Absolute URLs:** hreflang me `https://kumbuild.com/hi/pricing/` — relative URL Google ignore karta hai.
- **`x-default`:** `https://kumbuild.com/` (English default) par point karega.
- **Canonical:** har locale page ka canonical **khud** hoga — Hindi page ko English par canonicalize mat karo, warna Google Hindi URL ignore kar dega.
- **Sitemap:** har locale ke liye alag URLs, sirf wo pages jo us locale me actually exist karte hain (fallback English wale pages list nahi honge).
- **`<html lang>`:** har page par sahi — `en-US`, `hi`, `bn` (`Layout.astro` me `lang={locale}` — implement hai). Bina iske screen reader galat pronunciation karega.
- **`site:`** `astro.config.mjs` me `https://kumbuild.com` hai (absolute URL generation ke liye ready hai).

### 6.5 Fonts, numbers, dates

- **Fonts:** Latin ke liye Inter/system stack. **Hindi ke liye Noto Sans Devanagari, Bengali ke liye Noto Sans Bengali** — Poppins me Bengali glyphs nahi hote, isliye wo use nahi hoga. Doc kehta tha fonts `unicode-range` se load honge — **web src me authored `unicode-range` ka 0 occurrence hai** (Google ka served CSS apne aap include kar sakta hai — authored rule ke roop me record nahi hai).
- **Numbers / currency:** `Intl.NumberFormat(locale)` use karo. **Paise hamesha Indian grouping me:** `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })` — chahe UI locale koi bhi ho, ₹7,999 aise hi dikhega. **As implemented:** ye admin/home/app me hai (`formatINR` — "₹7,999 style — en-IN grouping, no decimals"), par **public site (web) pe nahi** — web prices JSON me hardcoded ₹ strings hain (display Indian grouping me sahi hai, mechanism doc se alag hai).
- **Dates:** `Intl.DateTimeFormat(locale)` — Hindi me date Hindi format me, English me US format me.
- **Text expansion:** Hindi/Bengali text English se ~20–30% lamba hota hai — buttons/cards me fixed height mat rakho, wrap hone do. (Layouts ke against verify nahi kiya — guidance hai, measured fact nahi.)

## 7. Tokens kahan rahenge (code banate time)

- **Source of truth (light, web):** `frontend/apps/web/src/styles/theme.css` — `@theme` tokens + `:root` vars. Naya token yahin banao.
- Shared tokens file: `frontend/packages/config/theme.ts` — **color tokens ke liye source of truth nahi hai** (v1 values, koi app value ke roop me import nahi karta — sirf `Locale` type + web ka `localePath`). Is file ke colors ko dekh ke naya code mat likho.
- Vite apps: `apps/account/src/index.css`, `apps/admin/src/index.css`, `apps/home/src/index.css` — landing wali `theme.css` tokens ki copy (sirf light). Copy drift ho chuki hai (§9) — naya token banate time teeno copies bhi update karo, ya shared import banao.
- Legacy Next.js: `apps/app/src/app/globals.css` — `:root` light + `[data-theme="dark"]` dark.
- Dictionaries: `frontend/packages/lib/src/i18n/*.json` (Section 6.3).

## 8. Sources — Exa se verify (2026-11-09)

- Astro i18n routing: locales + defaultLocale + `prefixDefaultLocale` (false = default unprefixed), `getRelativeLocaleUrl()`, fallback strategies. Source: docs.astro.build/en/guides/internationalization/; getastrothemes.com/blog/astro-multilingual-website-guide/ (2026-10-12).
- Next.js App Router i18n (LEGACY `apps/app` ke liye tha): built-in `i18n` config App Router me kaam nahi karta; static export me default locale root par + hi/bn `[locale]/` tree, next-intl, `localePrefix: "as-needed"` (middleware nahi — Exa-verified 2026-11-09, next-intl.dev/docs/routing/middleware "Usage without proxy/middleware (static export)" + GitHub discussion #2132/#2332).
- hreflang: reciprocity zaroori, absolute URLs, sirf existing locales, `x-default` default locale par. Source: olafboettcher.de/blog/multilingual-nextjs-hreflang (2026-09-09).
- Contrast ratios khud calculate kiye gaye hain (WCAG formula): white on #008EFD = 3.34:1, white on #0063B1 = 6.14:1, #008EFD on #0F172A = 5.61:1.
  **2026-11-11 correction:** v2 values ke liye ratios dobara calculate kiye — white on #0069C7 = 5.46:1, #0069C7 on paper
  #FAF9F6 = 5.19:1, white on #C2410C = 5.18:1, #008EFD on #0F172A = **5.35:1** (purana 5.61:1 galat tha).
- Palette Option A: 2026-11-09 ko 4 options me se assistant pick — user ne "best theme apply karo" bola.
- **v2 regrade source:** `theme.css` header — "Kumbuild theme v2 — professional light grading (BLUEPRINT 2026-11-10)".

## 9. Known drift — fix karna baki hai (2026-11-11, doc update ke time)

Ye code fixes hain, doc fixes nahi — isliye yahan sirf record kiya hai (Dus production se pehle fix karega):

1. **`theme.ts` v1 colors unused:** `theme.ts` ke BLUE/LIGHT values doc v1 se match karte hain par web `theme.css` (v2) se nahi — aur koi app unhe value ke roop me import nahi karta. Blue-600 teen taraf alag hai: doc #0072C8 = CSS #0072c8 ≠ `theme.ts` #0079D7 — ek value chuno. Fix: ya to `theme.ts` colors ko v2 se sync karo, ya file se color tokens hatao (sirf Locale/localePath rakho).
2. **Vite `index.css` copies stale:** teeno copies me pre-fix `[data-reveal]` rule + galat comment ("Without JS… they are simply visible") abhi bhi hai. Aaj harmless hai (Vite apps me koi data-reveal nahi hai), par ek hi fix ke baad drift ho chuka hai. Fix: `theme.css` ko dobara copy karo + drift check jodo, ya shared import banao.
3. **hreflang / canonical / sitemap not implemented** (§6.4) — implement karo ya scope se hatao.
4. **Missing-key rule as written not implemented** (§6.3) — per-key fallback + warning log implement karo, ya rule ko as-implemented likha rehne do (abhi wahi hai).
5. **Sora 800:** doc se hata diya (load nahi hota) — agar headings ko 800 chahiye to font URL me jodo, warna 700 hi max hai.
6. **Breakpoint tokens:** doc me bhi nahi, code me bhi nahi (Tailwind defaults chalte hain) — ya to tokens banao ya defaults ko explicitly record karo.
7. **Marquee / live-pulse reduced-motion gating:** abhi bhi nahi hai (§5) — `prefers-reduced-motion: reduce` me marquee aur live-pulse chalte rehte hain.
8. **Numbers mechanism (web):** web prices hardcoded ₹ strings hain, `Intl.NumberFormat` nahi (§6.5) — display sahi hai, par mechanism doc rule se alag hai.
