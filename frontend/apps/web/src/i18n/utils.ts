import { getDictionary, type Dictionary } from "@kumbuild/lib";
import { localePath, type Locale } from "@kumbuild/config";

export type { Dictionary, Locale };
export { localePath };

/** Resolve the locale for a page: Astro.currentLocale or the default. */
export function resolveLocale(currentLocale: string | undefined): Locale {
  if (currentLocale === "hi" || currentLocale === "bn") return currentLocale;
  return "en-US";
}

export function dictFor(locale: Locale): Dictionary {
  return getDictionary(locale);
}

/** href for a page slug in a locale (default locale has no prefix). */
export function pageUrl(locale: Locale, slug: string): string {
  return localePath(locale, slug);
}
