import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";

// Nested locale layout — sirf NON-default locales (hi, bn) ke liye.
// Default locale (en-US) root layout (src/app/layout.tsx) se aata hai.
// Ye provider root wale en-US provider ko override karta hai.
// <html>/<body> yahan NAHI — sirf root layout me hota hai.
export function generateStaticParams() {
  return routing.locales
    .filter((locale) => locale !== routing.defaultLocale)
    .map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Static rendering ke liye next-intl ko locale batana zaroori hai.
  setRequestLocale(locale);
  // NOTE (static export): getMessages({ locale }) — locale seedha pass
  // karo. Bina locale ke ye next-intl ka headers() fallback padhta hai,
  // jo static export me build fail kar deta hai.
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
