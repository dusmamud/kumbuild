# THEME.md — Kumbuild theme, color grading aur locales

> **Status (2026-11-13): UPDATED to v4.** Theme Option A "Trust Blue" user ne apply karne ko bola — best option
> assistant ne chuna (user: "aap best theme apply karo"). **v4 rule (Dus, 2026-11-12–13 — v3 ka warm-charcoal dark
> set supersede ho gaya): chhah apps (Next.js `apps/app` ko chhod kar) ki color grading EK hai — web app
> sirf light theme me rahega, baaki paanch apps (account, admin, blog, docs, home) me light AUR dark dono
> honge, aur dark palette sab me ek hi canonical Radix slateDark set hai (§4).** Dus ne 2026-11-12 ko
> account/admin/home ka dark Radix slateDark par le gaya; 2026-11-13 ko blog/docs me bhi wahi apply hua. 4 locales: English (US)
> default, Hindi, Bengali, Assamese (2026-11-13 ko `as` add hua — §6 updated).
>
> **Source of truth (2026-11-11 rewrite):** web app ka theme likha ja chuka hai — ye doc ab plan nahi, uska record
> hai. Light theme ke liye source of truth **`frontend/apps/web/src/styles/theme.css` (v2 warm paper,
> BLUEPRINT 2026-11-10)** hai. Dark theme ke liye source of truth **@radix-ui/colors 3.0.0 ka slateDark scale** hai — har dark app
> use `@import "@radix-ui/colors/slate-dark.css"` se laata hai aur apne tokens par map karta hai (§4);
> reference mapping account ki `index.css` hai (Dus, 2026-11-12). Neeche §2–§3–§5 ki values wahi se li gayi hain (khud verify ki gayi). **Purana v1
> (slate — pure white #FFFFFF, slate text) ab nahi chalta.** `frontend/packages/config/theme.ts` ke color tokens
> (BLUE/LIGHT) ko **koi app value ke roop me import nahi karta** — sirf `Locale` type aur web me `localePath`
> use hote hain (verify kiya) — wo v1 values rakhta hai aur source of truth **nahi** hai (drift §9 me).

## 1. Locked decisions

| Decision | Kya lock hua |
|---|---|
| Theme | **Option A — Trust Blue** (4 options me se best, assistant pick, user approved apply karne ko) |
| Primary colour | Logo wala hi: **#008EFD** — har jagah, sab apps me (v1 se v2 me nahi badla) |
| Astro (`apps/web`, kumbuild.com) | **Sirf light theme — warm paper** (`--bg #FAF9F6`, pure white nahi). Koi dark mode nahi, koi theme toggle nahi, `prefers-color-scheme` ko ignore karo. **(v3 me bhi sirf yahi app light-only hai.)** |
| Vite apps (`apps/account`, `apps/admin`, `apps/home`) | **Light + dark (v3)** — teeno ki `src/index.css` ek hi canonical token file hai (`--kb-*` variables, blog wali structure): light = §3 values, dark = §4 canonical set. Theme toggle header me hai; choice `localStorage` key `kb-theme` me save hoti hai, `index.html` ka inline script first paint se pehle `data-theme` set karta hai (no-flash). |
| Blog (`apps/blog`, Astro) | **Light + dark (v3)** — `--kb-*` tokens (`src/styles/theme.css`); dark is app ke tokens hi canonical dark set hain (§4). Toggle + `kb-theme` + no-flash script, blog ke BaseLayout me. |
| Docs (`apps/docs`, Astro + Starlight) | **Light + dark (v3)** — wahi grading Starlight ke `--sl-color-*` variables par mapped (`src/styles/starlight.css`); Starlight ka built-in toggle. Dark grays canonical set se hi liye gaye hain. |
| Legacy Next.js (`apps/app` — auth / home / admin) | **System / light / dark tha.** Default = system (device ki setting). User light ya dark choose kar sakta tha, choice save hoti thi. **Ye app LEGACY hai — iska slate dark legacy hai; naye apps ka dark canonical §4 Radix slateDark set hai.** |
| Locales | **4: `en-US` (default), `hi` (Hindi), `bn` (Bengali), `as` (Assamese — 2026-11-13 ko add hua).** Baad me aur add ho sakte hain, par URL structure abhi se final hai — launch ke baad badalna matlab redirects + SEO loss. |
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
- **Dark mode me link (v3 canonical):** `#66ADF9` (dark `primary-700` — §4; dark bg par readable hai). Legacy Next.js app ka `#33A5FD` naye apps me nahi chalta.
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

## 4. Dark theme tokens (v4 canonical — Radix slateDark — paanch apps: account, admin, blog, docs, home)

**Ek hi dark palette sab paanch dark apps me.** Values @radix-ui/colors 3.0.0 ke slateDark scale se aati
hain — har dark app `@import "@radix-ui/colors/slate-dark.css"` karta hai aur scale ko apne tokens par map
karta hai (Vite/blog `--kb-*` par, docs `--sl-color-*` par). Radix ki dark variables `.dark` class ke neeche
resolve hoti hain, isliye har app `data-theme` ke saath `.dark` class bhi sync karta hai (§5). Web app
(`apps/web`) is section se bahar hai — wo light-only hai (§1), usme dark CSS likhna mana hai.

| Token | Dark value | Light counterpart (§3) / note |
|---|---|---|
| paper / bg | `var(--slate-1)` #111113 | #FAF9F6 |
| surface (nav, sidebar, section bg) | `var(--slate-2)` #18191B | #F3F1EC |
| card | `var(--slate-3)` #212225 | #FFFFFF |
| surface-hover | `var(--slate-4)` #272A2D | line value hi reuse hota hai (blog/docs me token nahi hai) |
| line / hairline | `var(--slate-6)` #363A3F | #E7E2D9 |
| line-strong / hairline-light | `var(--slate-7)` #43484E | #DDD6C9 |
| ink (headings) | `var(--slate-12)` #EDEEF0 | #1C1917 |
| body text | `var(--slate-12)` #EDEEF0 | #44403C — dark me body ink jaisa hi bright hai (Dus ka mapping) |
| muted | `var(--slate-11)` #B0B4BA | #6F675E |
| faint | `var(--slate-10)` #777B84 | #A8A29E |
| primary-600 (button bg) | #3392F6 | #0072C8 — dark me ek step bright |
| primary-700 (text links) | #66ADF9 | #0069C7 |
| primary tint (badge bg) | #0B2F52 | #E8F3FE |
| CTA / CTA hover | #C2410C / #9A3412 | same — bright orange dark par AA fail (3.6:1), deep orange 5.2:1 pass |
| star / star-soft | #FBBF24 / #3A2F10 | #D97706 / #FEF3C7 |
| live (text/dots) | #4ADE80 | #15803D |
| live-strong (buttons, white text) | #15803D, hover #127032 | same dono themes — bright live button bg par white text fail hai |
| warn | #FBBF24 | #D97706 |
| danger (text/icons) | #F87171 | #DC2626 |
| live-soft / danger-soft (tint bgs) | base colour ka 12–14% tint paper par — Vite apps me `color-mix` (base #111113); blog/docs me ye tokens nahi hain | #E6F5EC / #FEF2F2 |

**Fixed ink panel rule:** brand strip aur ink panels dono themes me fixed `#1C1917` bg + white text +
`#4ADE80` live dot rakhte hain (blog header, docs strip) — ye token se nahi badalte, ye jaan-boojh kar hai:
panel har theme me "ink panel" hi dikhta hai, jaise web ke ink sections.

**LEGACY slate dark (sirf purana Next.js `apps/app`):** us app ke dark tokens slate ramp par the
(`--bg #0F172A`, `--surface #1E293B`, `--border #334155`, text `#F1F5F9 / #CBD5E1 / #94A3B8`, semantic
`--success #4ADE80`, `--warning #FBBF24`, `--error #F87171`, `--info #38BDF8`). Ye values naye apps me
**nahi** chalte — canonical dark upar wala Radix slateDark set hai.

**RETIRED (v4, 2026-11-13):** v3 ka hand-rolled warm-charcoal set (paper #141210, surface #1D1A17, card
#211E1A, ink #F5F2EC, body #D6D0C6, muted #A39A8D, line #322D28) kisi app me ab use nahi hota — blog/docs
bhi 2026-11-13 ko slateDark par aa gaye. Purane values ko naye code me mat lao.

## 5. Theme behaviour — kaise kaam karta hai (v2, coded)

### Astro (`apps/web`) — light only

- Sirf Section 3 ke tokens. Koi `data-theme`, koi dark media query, koi toggle button nahi.
- `prefers-color-scheme: dark` wale visitor ko bhi light site dikhegi — ye decision hai, bug nahi.
- Logo: `kumbuild-logo.svg` (transparent, blue mark) header/footer me. Blue-bg logo version (`public/logo/kumbuild-logo-blue-bg.png` + `.svg`) repo me hai — square tile (app icon / avatar) ke liye.
- **Scroll reveal (2026-11-11 fix):** content default visible hai. Sirf jab JS proven present ho (`<head>` inline script `html` par `.js` class lagata hai, first paint se pehle) tab `[data-reveal]` elements `opacity: 0` + `translateY(16px)` se start hote hain; observer `.is-in` lagata hai (0.7s, ease `cubic-bezier(0.22, 1, 0.36, 1)`). JS band ho to hidden state kabhi apply nahi hota — `<noscript>` fallback bhi hai. Ye rule sirf `prefers-reduced-motion: no-preference` me chalta hai.
- **Motion tokens:** `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`; marquee `42s linear infinite` (hover par pause hota hai); live-pulse `2.4s ease-in-out infinite`; hero float `kb-float 7s ease-in-out infinite` (reduced-motion me disabled). **Known gap:** marquee aur live-pulse ka `prefers-reduced-motion` gating abhi bhi nahi hai (§9).

### Vite apps (`apps/account`, `apps/admin`, `apps/home`) — light + dark (v4)

- Teeno ki `src/index.css` ek hi canonical token file hai (byte-identical copies): `@theme inline` mapping +
  `:root` light (§3 values) + `[data-theme="dark"]` (§4 Radix slateDark set, `@radix-ui/colors` 3.0.0 se
  import). Naya token teeno copies me ek saath badlo — ya shared import banao (abhi copy hi pattern hai).
- **Toggle:** har app ke header me `ThemeToggle` component (Lucide sun/moon). Click par `data-theme` flip
  hota hai, `.dark` class bhi sync hoti hai (Radix vars isi class ke neeche resolve hote hain), aur choice
  `localStorage` key `kb-theme` me save hoti hai — blog ke saath ek hi key, taaki user ki pasand sab apps me
  ek jaisi rahe.
- **No-flash rule:** `index.html` ke `<head>` me inline script — paint se pehle `kb-theme`/system padh ke
  `data-theme` + `.dark` class set karta hai (blog wala hi pattern).
- **Tailwind `dark:` variant:** v4 default `prefers-color-scheme` follow karta hai — isliye teeno CSS files me
  `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))` hai, taaki `dark:` styles
  toggle ke saath chalein (Dus ka catch, 2026-11-12 — pehle `dark:hover` sirf OS-dark par chalta tha).
- Contrast rules (Section 2) dono themes me lagu hain. Cards hamesha `bg-card` token se — `bg-white`
  hard-code mat karo (dark me safed reh jayega). White text wale green button ke liye `bg-live-strong`,
  bright `bg-live` sirf text/dots ke liye hai.

### Blog (`apps/blog`) aur Docs (`apps/docs`) — light + dark (v4)

- Blog: `--kb-*` tokens (`src/styles/theme.css`) — dark values Radix slateDark se (§4), Vite apps wala hi
  mapping. Toggle BaseLayout ke header me; `kb-theme` + no-flash script wahi pattern, dono `.dark` class bhi
  sync karte hain. `dark:` variant ke liye wahi `@custom-variant` rule hai.
- Docs: Starlight ka built-in toggle; grading `--sl-color-*` mapping se (`src/styles/starlight.css`) —
  dhyaan do, Starlight me `:root` = dark values aur `:root[data-theme="light"]` = light values hote hain
  (ulta convention). Dark values Radix slateDark se (§4). `.dark` sync `Head.astro` ke inline script se hota
  hai — pehli baar `data-theme` padh ke, phir `MutationObserver` se har toggle par. Brand strip dono themes me
  fixed ink panel hai (§4 rule).

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
| `as` | Assamese (অসমীয়া) | `kumbuild.com/as/` | Bengali-Assamese script — Noto Sans Bengali se render hota hai (§6.5). Web me 18 `/as/` pages, dict parity poori (20 top-level keys, en-US jaisi). |

- **URL structure: subfolders** (`/hi/`, `/bn/`, `/as/`) — Exa-verified web practice: ek domain, ek deploy, SEO ke liye sabse simple. Subdomain ya alag domain nahi.
- **Default locale ka prefix nahi:** English URLs `/pricing/` jaise rahenge, `/en-US/pricing/` nahi. Ye launch se pehle final hai — baad me badla to har URL redirect karna padega.
- **Slugs translate nahi honge (shuru me):** `/hi/pricing/` — slug English hi rahega, sirf content Hindi me. Translated slugs SEO ke liye behtar hote hain par routing complexity badhate hain; chhoti site ke liye same slug hi sahi hai. Baad me decide karke badla ja sakta hai.
- **Language switcher:** header me hamesha dikhega (EN | हिंदी | বাংলা | অসমীয়া). Switch karne par **wahi page** dusri locale me khulega — home par wapas nahi bhejna.

### 6.2 Sab apps me ek hi setup

**Astro (`apps/web`) — built-in i18n routing** (source: docs.astro.build/en/guides/internationalization/):

```js
// astro.config.mjs (code se match karta hai — verify kiya)
i18n: {
  locales: [
    { path: "hi", codes: ["hi"] },
    { path: "bn", codes: ["bn"] },
    { path: "as", codes: ["as"] },
    { path: "en-US", codes: ["en-US", "en"] },
  ],
  defaultLocale: "en-US",
  routing: { prefixDefaultLocale: false },
}
```

- Default locale unprefixed, `hi`/`bn`/`as` prefixed. Links banate time code hand-rolled `localePath` use karta hai (`frontend/packages/config/theme.ts` se, `src/i18n/utils.ts` me `pageUrl`) — Astro ka `getRelativeLocaleUrl()` code me **0 baar** use hota hai; behaviour same hai, sirf helper alag hai.
- `redirectToDefaultLocale` **false** rakho — `/` par English site khulegi, redirect nahi hoga.

**Vite apps (`apps/account`, `apps/admin`, `apps/home`) — URL prefix + shared dicts:**

- Locale URL ke pehle segment se padha jata hai (`/hi/...`, `/bn/...`, `/as/...`; en-US bina prefix). Router `basename` se kaam karta hai; `LocaleSwitcher` wahi page dusri locale me kholta hai.
- Dicts wahi shared files hain (`frontend/packages/lib/src/i18n/*.json`).
- **Note (2026-11-11):** 3 Vite apps abhi English-only hain — locale plumbing (`LocaleProvider` + `LocaleSwitcher`) scaffolded hai, page strings English me hain. App pages ki full i18n baad me hogi.

**LEGACY — Next.js (`apps/app`) — `next-intl` + `[locale]` segment** (source: next-intl.dev/docs/routing/configuration):

```ts
// i18n/routing.ts
export const routing = defineRouting({
  locales: ["en-US", "hi", "bn", "as"],
  defaultLocale: "en-US",
  localePrefix: "as-needed", // default unprefixed, baaki prefixed
});
```

- App Router me Next.js ka purana built-in `i18n` config **kaam nahi karta** (wo Pages Router ka tha) — isliye `next-intl` use hoga. **Static export me middleware nahi chalta** (Exa-verified, next-intl docs 2026-11-09): default locale (en-US) root par hai (bina prefix), hi/bn/as `[locale]/` tree me hain; locale server se negotiate nahi hota.
- **Detection priority (LOCKED):** 1) URL me locale, 2) user ki saved choice (LocaleSwitcher link — client-side), 3) default `en-US`. URL hamesha jeetega — cookie se redirect loop nahi banana. `Accept-Language` header server pe nahi padha jata (koi server hi nahi hai).

### 6.3 Shared dictionaries — ek source of truth

- Strings **ek jagah** rahenge: `frontend/packages/lib/src/i18n/` — `en-US.json`, `hi.json`, `bn.json`, `as.json` (Assamese, 2026-11-13). Sab apps (Astro + Vite) wahi files import karenge. Kisi bhi app me apni copy nahi banegi — copy bani to dono drift karenge. (Legacy Next.js app bhi wahi dicts use karta hai — `apps/app/src/i18n/request.ts:3` imports `getDictionary`.)
- **Keys namespaced** honge: `nav.pricing`, `pricing.business.title` jaise — flat keys nahi. (Note: doc ke purane examples `pricing.business.title` / `order.form.name.label` literal keys ke roop me exist nahi karte — order keys namespace ke andar flat hain; structure broad sense me namespaced hai.)
- **Plurals / variables ICU MessageFormat se:** `{count, plural, one {# page} other {# pages}}` — Hindi/Bengali me plural rules English se alag hote hain, hard-coded `s` mat lagao.
- **Missing key rule (as implemented, 2026-11-11):** `getDictionary` sirf **whole-dictionary fallback** karta hai (`?? enUS`) — ek key missing ho to per-key fallback **nahi** hota, aur koi warning log bhi nahi hai. Aaj ye rule test nahi hua kyunki compile-time parity hai (`type Dictionary = typeof enUS` — missing key build error hai) aur aaj saari keys chaaron locales me maujood hain. Purana doc rule ("en-US dikhega + warning log hoga") implementation se match nahi karta — ya to per-key fallback implement karo, ya rule ko yahi likha rehne do.
- **Translation workflow:** user (Dus) ya translator JSON edit karega — code change nahi. Har PR me check: har key chaaron locales me hai ya fallback list me hai.
- **Humanization (2026-11-13):** Hindi aur Bengali dicts humanize hue — 100% Devanagari aur authentic Bangla (machine-translated feel nahi). Nayi keys likhte time wahi standard rakho — seedha angrezi ka shabd-shah anuvaad nahi.

### 6.4 SEO — hreflang, canonical, sitemap

**NOT IMPLEMENTED on web (2026-11-11, verify kiya):** `Layout.astro` me `canonical` / `hreflang` / `og:url` / `twitter:*`
ka **ek bhi occurrence nahi** hai, aur `astro.config.mjs` me `@astrojs/sitemap` integration nahi hai. Neeche ke rules
**target hain, current state nahi** — implement karne tak inhe rule mat mano:

- **hreflang reciprocity:** har page har locale ko refer karega, khud ko bhi. Ek taraf ka link Google poora set discard kar deta hai. Ye ek shared helper se generate hoga — haath se per-page mat likho.
- **Absolute URLs:** hreflang me `https://kumbuild.com/hi/pricing/` — relative URL Google ignore karta hai.
- **`x-default`:** `https://kumbuild.com/` (English default) par point karega.
- **Canonical:** har locale page ka canonical **khud** hoga — Hindi page ko English par canonicalize mat karo, warna Google Hindi URL ignore kar dega.
- **Sitemap:** har locale ke liye alag URLs, sirf wo pages jo us locale me actually exist karte hain (fallback English wale pages list nahi honge).
- **`<html lang>`:** har page par sahi — `en-US`, `hi`, `bn`, `as` (`Layout.astro` me `lang={locale}` — implement hai). Bina iske screen reader galat pronunciation karega.
- **`site:`** `astro.config.mjs` me `https://kumbuild.com` hai (absolute URL generation ke liye ready hai).

### 6.5 Fonts, numbers, dates

- **Fonts:** Latin ke liye Inter/system stack. **Hindi ke liye Noto Sans Devanagari, Bengali ke liye Noto Sans Bengali** — Poppins me Bengali glyphs nahi hote, isliye wo use nahi hoga. **Assamese ke liye alag font nahi chahiye** — Assamese Bengali-Assamese script me likha jaata hai, isliye Noto Sans Bengali hi usko render karta hai (Layout me koi naya font add nahi hua). Doc kehta tha fonts `unicode-range` se load honge — **web src me authored `unicode-range` ka 0 occurrence hai** (Google ka served CSS apne aap include kar sakta hai — authored rule ke roop me record nahi hai).
- **Numbers / currency:** `Intl.NumberFormat(locale)` use karo. **Paise hamesha Indian grouping me:** `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })` — chahe UI locale koi bhi ho, ₹7,999 aise hi dikhega. **As implemented:** ye admin/home/app me hai (`formatINR` — "₹7,999 style — en-IN grouping, no decimals"), par **public site (web) pe nahi** — web prices JSON me hardcoded ₹ strings hain (display Indian grouping me sahi hai, mechanism doc se alag hai).
- **Dates:** `Intl.DateTimeFormat(locale)` — Hindi me date Hindi format me, English me US format me.
- **Text expansion:** Hindi/Bengali/Assamese text English se ~20–30% lamba hota hai — buttons/cards me fixed height mat rakho, wrap hone do. (Layouts ke against verify nahi kiya — guidance hai, measured fact nahi.)

## 7. Tokens kahan rahenge (code banate time)

- **Source of truth (light, web):** `frontend/apps/web/src/styles/theme.css` — `@theme` tokens + `:root` vars. Naya token yahin banao.
- Shared tokens file: `frontend/packages/config/theme.ts` — **color tokens ke liye source of truth nahi hai** (v1 values, koi app value ke roop me import nahi karta — sirf `Locale` type + web ka `localePath`). Is file ke colors ko dekh ke naya code mat likho.
- Vite apps: `apps/account/src/index.css`, `apps/admin/src/index.css`, `apps/home/src/index.css` — ek hi canonical token file ki copies (light §3 + dark §4 Radix slateDark, v4). Naya token banate time teeno copies bhi update karo, ya shared import banao.
- Blog: `apps/blog/src/styles/theme.css` — `--kb-*` tokens; dark values Radix slateDark se (§4).
- Docs: `apps/docs/src/styles/starlight.css` — wahi grading `--sl-color-*` par mapped (dark Radix slateDark se, §4).
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
2. **Vite `index.css` copies stale — RESOLVED (v3, 2026-11-11):** teeno copies canonical token file se rebuild ho gayi hain (light §3 + dark §4 + `data-theme` toggle); pre-fix `[data-reveal]` rule aur unused marquee/float blocks hat gaye (Vite apps me unka koi use nahi tha). Copies ab bhi haath se sync hoti hain — drift check ya shared import aage ka kaam hai. **v3 me ye bhi band hua:** blog/docs is doc me pehle shaamil hi nahi the — §1/§4/§5/§7 me ab dono apps recorded hain. **v4 (2026-11-13):** dark set warm-charcoal se Radix slateDark par badla — paanchon dark apps ab ek hi scale use karte hain, theme split khatam.
3. **hreflang / canonical / sitemap not implemented** (§6.4) — implement karo ya scope se hatao.
4. **Missing-key rule as written not implemented** (§6.3) — per-key fallback + warning log implement karo, ya rule ko as-implemented likha rehne do (abhi wahi hai).
5. **Sora 800:** doc se hata diya (load nahi hota) — agar headings ko 800 chahiye to font URL me jodo, warna 700 hi max hai.
6. **Breakpoint tokens:** doc me bhi nahi, code me bhi nahi (Tailwind defaults chalte hain) — ya to tokens banao ya defaults ko explicitly record karo.
7. **Marquee / live-pulse reduced-motion gating:** abhi bhi nahi hai (§5) — `prefers-reduced-motion: reduce` me marquee aur live-pulse chalte rehte hain.
8. **Numbers mechanism (web):** web prices hardcoded ₹ strings hain, `Intl.NumberFormat` nahi (§6.5) — display sahi hai, par mechanism doc rule se alag hai.
