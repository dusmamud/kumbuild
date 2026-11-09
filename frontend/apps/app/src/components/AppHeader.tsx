import { getSession, logoutAction } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
import ThemeToggle from "./ThemeToggle";

// Admin header — logo + nav + locale switcher + theme toggle + logout.
// Sirf admin dashboard me use hota hai (customer dashboard nahi hai).
const ADMIN_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/customers", label: "Customers" },
  { href: "/builds", label: "Builds" },
  { href: "/payments", label: "Payments" },
  { href: "/settings", label: "Settings" },
];

export default async function AppHeader() {
  const session = await getSession();

  return (
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
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
        </Link>

        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
          {ADMIN_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-body hover:text-primary-text">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
          {session ? (
            <form action={logoutAction} className="flex items-center gap-2">
              <span className="hidden text-xs text-muted sm:inline">
                {session.name} ({session.role})
              </span>
              <button
                type="submit"
                className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-hover"
              >
                Logout
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}
