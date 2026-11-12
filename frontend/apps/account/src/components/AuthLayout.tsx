import type { ReactNode } from "react";
import { LocaleSwitcher } from "../lib/i18n";
import ThemeToggle from "./ThemeToggle";
import { WEB_URL } from "../lib/urls";

// Shared shell for the auth pages: NO card — plain paper background,
// form column capped at 400px centred on the page, logo above the
// heading, ThemeToggle + LocaleSwitcher top-right, footer lines under
// the form. Mobile: full-width form with 16px side padding.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex items-center justify-end gap-2 px-4 pt-4 sm:px-6">
        <ThemeToggle />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-8">
        <div className="w-full max-w-[400px]">
          <a
            href={WEB_URL}
            className="mb-6 flex justify-center"
            aria-label="Kumbuild — back to kumbuild.com"
          >
            <img src="/logo/kumbuild-logo.svg" alt="Kumbuild" className="h-12 w-12" />
          </a>
          {children}
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          Kumbuild — Tell us what to build.
        </p>
        <p className="mt-1 text-center text-sm">
          <a href={WEB_URL} className="font-medium text-primary-700 hover:underline">
            Back to kumbuild.com
          </a>
        </p>
      </main>
    </div>
  );
}
