import type { ReactNode } from "react";
import { LocaleSwitcher } from "../lib/i18n";
import ThemeToggle from "./ThemeToggle";
import { WEB_URL } from "../lib/urls";

// Shared shell for the auth pages — SPLIT PANEL (see
// ~/workspace/shot-tools/login-signup-research/RESEARCH.md §1: signup is a
// selling moment, so the form shares the page with ONE honest proof asset
// instead of sitting alone on plain paper).
//
// - Form side first in DOM (the panel must never gate the form); on lg+ the
//   panel is visually left via lg:order-1 / form lg:order-2.
// - Left panel: hidden below lg — mobile gets the form alone, full-width
//   with 16px side padding. Panel background is a TINTED NEUTRAL theme
//   surface (light: --kb-surface; dark: Radix slate-2), never a saturated
//   brand flood, never a gradient.
// - ONE proof asset: a real sample-site screenshot from the web app
//   (frontend/apps/web/public/demo/shop.png, copied to this app's
//   public/demo/ — the account app is a separate deployment, so it must
//   not hotlink the web app). Caption reuses the honest wording from
//   frontend/apps/web/src/components/Examples.astro: a demo shop website,
//   NOT a testimonial (ours are labelled samples).
// - Logo rule: the logo lives in the panel on lg+; below lg the panel is
//   hidden, so a small logo sits above the form there — one logo visible
//   at a time, never zero, never two.
// - Form side stays NO-CARD: plain paper, 400px column, ThemeToggle +
//   LocaleSwitcher top-right, footer lines under the form.
// - TurnstileSlot, OTP countdown, RHF+zod, a11y, motion, sonner, and the
//   terms/privacy line all live in the pages — untouched by this shell.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-2">
      {/* Form side — first in DOM. */}
      <div className="flex flex-col lg:order-2">
        <header className="flex items-center justify-end gap-2 px-4 pt-4 sm:px-6">
          <ThemeToggle />
          <LocaleSwitcher />
        </header>
        <main className="flex flex-1 flex-col items-center px-4 py-8">
          <div className="w-full max-w-[400px]">
            <a
              href={WEB_URL}
              className="mb-6 flex justify-center lg:hidden"
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

      {/* Proof panel — hidden below lg. */}
      <aside className="hidden flex-col bg-surface px-10 py-8 lg:order-1 lg:flex xl:px-14">
        <a
          href={WEB_URL}
          className="flex items-center gap-3"
          aria-label="Kumbuild — back to kumbuild.com"
        >
          <img src="/logo/kumbuild-logo.svg" alt="" className="h-10 w-10" />
          <span className="text-lg font-semibold text-ink">Kumbuild</span>
        </a>
        <figure className="flex flex-1 flex-col justify-center py-10">
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <div className="flex items-center gap-2 border-b border-line bg-white px-3 py-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-line" />
              <span className="ml-1 truncate rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs text-muted">
                sharma-general-store.in
              </span>
            </div>
            <img
              src="/demo/shop.png"
              alt="Demo shop website — Sharma General Store, with products, prices and WhatsApp ordering"
              width="1280"
              height="800"
              className="block aspect-[8/5] w-full object-cover object-top"
            />
          </div>
          <figcaption className="mt-3 text-sm text-body">
            <span className="font-semibold text-ink">Sharma General Store</span> — sample
            shop website built with Kumbuild
          </figcaption>
        </figure>
        <p className="text-sm text-muted">
          SSL secure · No card needed to sign up ·{" "}
          <a href={`${WEB_URL}/terms`} className="font-medium text-primary-700 hover:underline">
            Terms
          </a>{" "}
          ·{" "}
          <a href={`${WEB_URL}/privacy`} className="font-medium text-primary-700 hover:underline">
            Privacy
          </a>
        </p>
      </aside>
    </div>
  );
}
