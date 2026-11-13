import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { logout } from "@kumbuild/lib";
import { ACCOUNT_URL, WEB_URL } from "../lib/urls";
import { LocaleSwitcher } from "../lib/i18n";
import ThemeToggle from "./ThemeToggle";

async function handleLogout() {
  // Real logout: deletes the server session (Go API) + local cache.
  // ?logged_out=1 tells the account login page to show the form
  // instead of bouncing back here on its /me check.
  await logout();
  window.location.href = `${ACCOUNT_URL}/login?logged_out=1`;
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
          <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2">
            <img
              src="/logo/kumbuild-logo.svg"
              alt="Kumbuild"
              className="h-8 w-8 shrink-0"
            />
            {/* Wordmark hidden below sm (same as the account header):
                at <640px the header only fits the logo mark + theme
                toggle + compact pill + Log out icon. The mark alone
                still links home. */}
            <span className="hidden truncate font-display text-lg font-semibold text-ink sm:inline">
              Kumbuild
            </span>
          </Link>

          <nav className="order-3 flex w-full items-center gap-1 text-sm font-medium sm:order-none sm:w-auto sm:gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-md px-2.5 py-1.5 ${
                  isActive
                    ? "text-primary-700 underline underline-offset-4"
                    : "text-body hover:text-ink"
                }`
              }
            >
              My orders
            </NavLink>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `rounded-md px-2.5 py-1.5 ${
                  isActive
                    ? "text-primary-700 underline underline-offset-4"
                    : "text-body hover:text-ink"
                }`
              }
            >
              Profile
            </NavLink>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1.5 text-sm font-medium text-body hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
              {/* "Log out" text only from md: below 768px the single row
                  (wordmark + nav + toggle + pill + this button) only fits
                  with the icon alone — the button stays fully visible and
                  keeps its accessible name via aria-label. */}
              <span className="hidden md:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Kumbuild — Tell us what to build. ·{" "}
            <a
              href={WEB_URL}
              className="font-medium text-primary-700 hover:underline"
            >
              kumbuild.com
            </a>
          </p>
          <p className="text-xs">
            Demo data — orders shown here are samples while the backend is
            being built.
          </p>
        </div>
      </footer>
    </div>
  );
}
