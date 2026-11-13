// Kumbuild shared theme tokens — single source of truth.
// Source: THEME.md (Option A "Trust Blue", LOCKED 2026-11-09).
// Primary is the logo blue #008EFD everywhere. Astro uses light only;
// the Next.js app also uses the dark tokens below.

export const LOCALES = ["en-US", "hi", "bn", "as"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en-US";

export const BLUE = {
  50: "#EBF6FF",
  100: "#CCE8FF",
  200: "#99D2FE",
  300: "#66BBFE",
  400: "#33A5FD",
  500: "#008EFD",
  600: "#0079D7",
  700: "#0063B1",
  800: "#00477E",
  900: "#002B4C",
} as const;

export const LIGHT = {
  bg: "#FFFFFF",
  surface: "#F8FAFC",
  surfaceHover: "#F1F5F9",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  textHeading: "#0F172A",
  textBody: "#334155",
  textMuted: "#64748B",
  textOnPrimary: "#FFFFFF",
  primary: BLUE[500],
  primaryHover: BLUE[600],
  primaryText: BLUE[700],
  primaryTint: BLUE[50],
  success: "#16A34A",
  successBg: "#F0FDF4",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  info: "#0284C7",
} as const;

export const DARK = {
  bg: "#0F172A",
  surface: "#1E293B",
  surfaceHover: "#283449",
  border: "#334155",
  borderStrong: "#475569",
  textHeading: "#F1F5F9",
  textBody: "#CBD5E1",
  textMuted: "#94A3B8",
  textOnPrimary: "#FFFFFF",
  primary: BLUE[500],
  primaryHover: BLUE[400],
  primaryText: BLUE[400],
  primaryTint: "#1E293B",
  success: "#4ADE80",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#38BDF8",
} as const;

/** Locale path prefix: default locale has none, others are prefixed. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean === "/" ? "/" : clean;
  return `/${locale}${clean === "/" ? "/" : clean}`;
}
