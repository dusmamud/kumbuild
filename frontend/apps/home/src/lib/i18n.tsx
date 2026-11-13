import { createContext, useContext, type ReactNode } from "react";
import { getDictionary, isLocale, type Dictionary } from "@kumbuild/lib";
import type { Locale } from "@kumbuild/config";

/**
 * Locale from the URL: /hi/... or /bn/...; en-US has no prefix (same as
 * the Astro landing page and the Next.js app). The router basename is set
 * from this locale in App.tsx, so routes are locale-agnostic.
 */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split("/").filter(Boolean)[0];
  return isLocale(first ?? "") ? (first as Locale) : "en-US";
}

export function localePrefix(locale: Locale): string {
  return locale === "en-US" ? "" : `/${locale}`;
}

interface LocaleValue {
  locale: Locale;
  dict: Dictionary;
}

const LocaleContext = createContext<LocaleValue>({
  locale: "en-US",
  dict: getDictionary("en-US"),
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, dict: getDictionary(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleValue {
  return useContext(LocaleContext);
}

/** Switch locale by full navigation (keeps the same page path). */
export function switchLocale(locale: Locale): void {
  const path = window.location.pathname;
  const first = path.split("/").filter(Boolean)[0];
  const rest = isLocale(first ?? "")
    ? `/${path.split("/").filter(Boolean).slice(1).join("/")}`
    : path;
  const clean = rest === "/" || rest === "" ? "" : rest;
  window.location.href = `${localePrefix(locale)}${clean || "/"}${window.location.search}${window.location.hash}`;
}

const LOCALE_LABELS: Record<Locale, string> = {
  "en-US": "English",
  hi: "हिंदी",
  bn: "বাংলা",
  as: "অসমীয়া",
};

/**
 * 2-letter codes for the collapsed pill below `md` — same codes as the
 * account app (RESPONSIVE_P0_REPORT.md §1). The full names need ~243px;
 * the home header also carries the nav links + Log out, so below 768px
 * the single row only fits with the short codes (~160px). Same four
 * buttons, same behaviour — only the label shortens below `md`.
 * (Account collapses below `sm`; home needs `md` because of the extra
 * header content — at 640 the full pill + Log out overflows 58px.)
 */
const LOCALE_SHORT: Record<Locale, string> = {
  "en-US": "EN",
  hi: "हिं",
  bn: "বাং",
  as: "অ",
};

export function LocaleSwitcher() {
  const { locale } = useLocale();
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-card p-1 text-[13px] font-medium">
      {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchLocale(l)}
          aria-pressed={locale === l}
          className={
            locale === l
              ? "rounded-full bg-ink px-2.5 py-1 text-paper"
              : "rounded-full px-2.5 py-1 text-muted hover:text-ink"
          }
        >
          <span className="md:hidden">{LOCALE_SHORT[l]}</span>
          <span className="hidden md:inline">{LOCALE_LABELS[l]}</span>
        </button>
      ))}
    </div>
  );
}
