"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Language switcher — wahi page dusri locale me kholta hai (THEME.md 6.1).
// EN | हिंदी | বাংলা. next-intl ka Link locale prop se prefix lagata hai.
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
              href={pathname}
              locale={l.code}
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
