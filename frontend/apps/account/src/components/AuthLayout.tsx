import type { ReactNode } from "react";
import { LocaleSwitcher } from "../lib/i18n";
import ThemeToggle from "./ThemeToggle";
import { WEB_URL } from "../lib/urls";

// Shared shell for the auth pages — CENTERED CARD, rebuilt from scratch
// (2026-11-12). Dus rejected three layouts in a row: the original centered
// card, the no-card bare form, and the split panel with a demo screenshot.
// This is a deliberate return to the card — but executed properly, because
// the references Dus named (Google, Meta, Spotify auth in 2026) are ALL
// centered cards. The original card failed because it was plain — no top
// nav, no card treatment, empty background — not because cards are wrong.
//
// Composition:
// - A real top nav: Kumbuild logo + wordmark left (the ONE logo per view);
//   ThemeToggle + LocaleSwitcher + "Back to kumbuild.com" right. The nav
//   gives the page a header area, so the card never floats in empty space.
// - A non-empty background: warm paper with a quiet dot texture
//   (.auth-bg in index.css — dots in the theme line colour only, no
//   colour gradient, no saturated flood).
// - A real card: bg-card, 1px line border, 16px radius, subtle two-layer
//   shadow, 440px column, generous p-6/sm:p-8 padding. Headings are
//   LEFT-aligned inside the card (Google-style hierarchy), not centred.
// - The card is vertically centred in the viewport at desktop widths,
//   with a trust line under it (SSL · No card · Terms · Privacy) so the
//   1440 view reads finished, not sparse.
// - TurnstileSlot, OTP countdown, RHF+zod, a11y, motion, sonner, and the
//   terms/privacy line all live in the pages — untouched by this shell.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-bg flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <a
          href={WEB_URL}
          className="flex items-center gap-2.5"
          aria-label="Kumbuild — back to kumbuild.com"
        >
          <img src="/logo/kumbuild-logo.svg" alt="" className="h-9 w-9" />
          <span className="font-display text-lg font-semibold text-ink">Kumbuild</span>
        </a>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Account">
          <a
            href={WEB_URL}
            className="hidden text-sm font-medium text-muted hover:text-ink sm:block"
          >
            Back to kumbuild.com
          </a>
          <ThemeToggle />
          <LocaleSwitcher />
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[460px]">
          <div className="auth-card rounded-2xl border border-line bg-card p-6 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_12px_32px_-12px_rgb(0_0_0/0.18)] sm:p-8 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_16px_40px_-12px_rgb(0_0_0/0.6)]">
            {children}
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            SSL secure · No card needed to sign up ·{" "}
            <a href={`${WEB_URL}/terms`} className="font-medium text-primary-700 hover:underline">
              Terms
            </a>{" "}
            ·{" "}
            <a href={`${WEB_URL}/privacy`} className="font-medium text-primary-700 hover:underline">
              Privacy
            </a>
          </p>
          <p className="mt-1 text-center text-sm text-muted">
            Kumbuild — Tell us what to build.
          </p>
        </div>
      </main>
    </div>
  );
}
