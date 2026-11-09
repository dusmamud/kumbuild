"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";

// Admin dashboard layout — admin.kumbuild.com.
// Guard RequireAdmin (client-side) me hai: bina session ke /login.
// NOTE: client component hai — next-intl ka getTranslations server
// component me static export ke time headers() padhta hai, aur footer
// tagline context se aata hai.
export default function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("footer");
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-muted">
        Kumbuild Admin — {t("tagline")}
      </footer>
    </div>
  );
}
