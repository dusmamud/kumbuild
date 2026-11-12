import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getSession, logout, type Session } from "@kumbuild/lib";
import { LocaleSwitcher } from "../lib/i18n";
import ThemeToggle from "./ThemeToggle";
import { ACCOUNT_URL } from "../lib/urls";

// Admin header — logo + nav + locale switcher + theme toggle + logout.
// Sirf admin dashboard me use hota hai. Ported from the Next.js app's
// AppHeader.tsx. Light + dark (THEME.md v3) — ThemeToggle included.
const ADMIN_LINKS = [
  { href: "/", label: "Dashboard", end: true },
  { href: "/orders", label: "Orders", end: false },
  { href: "/customers", label: "Customers", end: false },
  { href: "/builds", label: "Builds", end: false },
  { href: "/payments", label: "Payments", end: false },
  { href: "/settings", label: "Settings", end: false },
];

export default function AppHeader() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  async function onLogout() {
    // Real logout: deletes the server session (Go API) + local cache.
    // ?logged_out=1 tells the account login page to show the form
    // instead of bouncing back here on its /me check.
    await logout();
    window.location.href = `${ACCOUNT_URL}/login?logged_out=1`;
  }

  return (
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2">
          {/* Logo: public/logo/ ka variant — naya logo mat banao. */}
          <img
            src="/logo/kumbuild-logo.svg"
            alt="Kumbuild"
            width={32}
            height={32}
          />
          <span className="text-lg font-bold text-ink">
            Kumbuild
            <span className="ml-2 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary-text">
              Admin
            </span>
          </span>
        </NavLink>

        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
          {ADMIN_LINKS.map((l) => (
            <NavLink
              key={l.href}
              to={l.href}
              end={l.end}
              className={({ isActive }) =>
                isActive
                  ? "font-semibold text-primary-text"
                  : "text-body hover:text-primary-text"
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <LocaleSwitcher />
          {session ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted sm:inline">
                {session.name} ({session.role})
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-hover"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
