import { defineRouting } from "next-intl/routing";

// Locales — THEME.md Section 6 (LOCKED):
// en-US default (URL me koi prefix nahi), hi -> /hi/, bn -> /bn/, as -> /as/.
// Slugs translate nahi hote — /hi/pricing/ jaisa, slug English hi rahega.
export const routing = defineRouting({
  locales: ["en-US", "hi", "bn", "as"],
  defaultLocale: "en-US",
  // "as-needed": default locale unprefixed, baaki prefixed.
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
