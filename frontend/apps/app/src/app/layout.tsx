import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import "./globals.css";

// No-flash theme script (THEME.md Section 5): paint se PEHLE data-theme
// set karo — warna page pehle light dikhega, phir dark hoga.
// Cookie kb_theme: "system" | "light" | "dark" (default system).
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )kb_theme=([^;]*)/);var t=m?decodeURIComponent(m[1]):"system";var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";document.documentElement.setAttribute("data-theme",d);}catch(e){}})();`;

// Root layout — DEFAULT locale (en-US, THEME.md Section 6, LOCKED).
// Static export me middleware nahi hota, isliye default locale ke pages
// yahan seedha root par hain (bina /en-US prefix ke): /login, /orders...
// hi/bn ke pages [locale]/ tree me hain — wahan ka nested provider is
// en-US provider ko override karta hai.
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = routing.defaultLocale;
  // Static rendering ke liye next-intl ko locale batana zaroori hai.
  setRequestLocale(locale);
  // NOTE (static export): getMessages({ locale }) — locale seedha pass
  // karo. Bina locale ke ye next-intl ka headers() fallback padhta hai,
  // jo static export me build fail kar deta hai.
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
