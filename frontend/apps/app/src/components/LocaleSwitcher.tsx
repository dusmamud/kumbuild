"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { routing } from "@/i18n/routing";

// Language switcher — wahi page dusri locale me kholta hai (THEME.md 6.1).
// EN | हिंदी | বাংলা.
//
// NOTE (static export): next-intl ka Link `locale` prop ke saath default
// locale par bhi prefix force karta hai (/en-US/...) — aur static export
// me /en-US/... files hoti hi nahi (default locale unprefixed hai).
// Isliye yahan plain next/link + khud ka href banate hain:
// current path se prefix hatao, phir target locale ka prefix lagao.
function localeHref(pathname: string, target: string): string {
  const stripped = pathname.replace(/^\/(hi|bn)(?=\/|$)/, "") || "/";
  if (target === routing.defaultLocale) return stripped;
  return stripped === "/" ? `/${target}` : `/${target}${stripped}`;
}

const LOCALES = [
  { code: "en-US", label: "EN" },
  { code: "hi", label: "हिंदी" },
  { code: "bn", label: "বাংলা" },
] as const;

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav className="inline-flex items-center gap-1 text-xs font-semibold" aria-label="Language">
      {LOCALES.map((l, i) => (
        <span key={l.code} className="inline-flex items-center gap-1">
          {i > 0 ? <span className="text-muted">|</span> : null}
          {l.code === locale ? (
            <span className="text-primary-text">{l.label}</span>
          ) : (
            <Link
              href={localeHref(pathname, l.code)}
              className="text-muted hover:text-ink"
            >
              {l.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
