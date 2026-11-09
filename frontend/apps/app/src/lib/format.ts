// Formatting helpers — THEME.md Section 6.5:
// paise HAMESHA Indian grouping me (en-IN), chahe UI locale koi bhi ho.
// Dates UI locale ke hisaab se.

export function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
