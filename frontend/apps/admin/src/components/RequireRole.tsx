import { useEffect, useState, type ReactNode } from "react";
import { fetchSession, type Role, type Session } from "@kumbuild/lib";
import { ACCOUNT_URL, HOME_URL } from "../lib/urls";

/**
 * Route guard (real backend). The session is validated against the Go
 * API (GET /api/auth/me, cookie session) on mount — the localStorage
 * profile cache alone never grants access.
 * - No session -> central login on the account app (with ?next= back).
 * - A signed-in CUSTOMER is staff-blocked here with a clear message
 *   instead of a redirect loop: the admin area is staff-only
 *   (super_admin / admin / customer_service on the backend).
 * Real role enforcement still happens in the Go backend, per API call.
 */
export default function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    fetchSession().then((s) => {
      if (live) setSession(s);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (session === null) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${ACCOUNT_URL}/login?next=${next}`;
    }
  }, [session]);

  if (session === undefined || session === null) return null;

  if (session.role !== role) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Staff only</h1>
        <p className="mt-2 text-sm text-muted">
          You&apos;re signed in as {session.email} with a customer account. The admin area is
          for Kumbuild staff only.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <a
            href={HOME_URL}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 dark:hover:bg-primary-500"
          >
            Go to your dashboard
          </a>
          <a
            href={`${ACCOUNT_URL}/login`}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-card"
          >
            Log in with a staff account
          </a>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
