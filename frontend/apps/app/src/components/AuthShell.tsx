import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

// Auth layout — beech me chhota card, upar logo. Sidebar nahi hota.
export default async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("footer");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/login" className="flex items-center gap-2">
            <img
              src="/logo/kumbuild-logo.svg"
              alt="Kumbuild"
              width={32}
              height={32}
            />
            <span className="text-lg font-bold text-ink">Kumbuild</span>
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:p-8">
          {children}
        </div>
      </main>
      <footer className="py-4 text-center text-xs text-muted">
        Kumbuild — {t("tagline")}
      </footer>
    </div>
  );
}
