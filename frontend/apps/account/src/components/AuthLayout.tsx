import type { ReactNode } from "react";
import { LocaleSwitcher } from "../lib/i18n";
import { WEB_URL } from "../lib/urls";

// Shared shell for the auth pages: centered card (max-w-md) on paper,
// logo on top, LocaleSwitcher top-right, footer under the card.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex justify-end px-4 pt-4 sm:px-6">
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:p-8">
            <a
              href={WEB_URL}
              className="mb-6 flex justify-center"
              aria-label="Kumbuild — back to kumbuild.com"
            >
              <img src="/logo/kumbuild-logo.svg" alt="Kumbuild" className="h-12 w-12" />
            </a>
            {children}
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            Kumbuild — Tell us what to build.
          </p>
          <p className="mt-1 text-center text-sm">
            <a href={WEB_URL} className="font-medium text-primary-700 hover:underline">
              Back to kumbuild.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
