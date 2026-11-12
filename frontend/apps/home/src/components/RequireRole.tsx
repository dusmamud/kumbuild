import { useEffect, useState, type ReactNode } from "react";
import { fetchSession, type Role, type Session } from "@kumbuild/lib";
import { ACCOUNT_URL } from "../lib/urls";

/**
 * Route guard (real backend). The session is validated against the Go
 * API (GET /api/auth/me, cookie session) on mount — the localStorage
 * profile cache alone never grants access.
 * No session (or a staff session, which belongs in the admin app) ->
 * central login on the account app, which routes each role to its app.
 * Real role enforcement happens in the Go backend, per API call.
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
    if (session === undefined) return;
    if (!session || session.role !== role) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${ACCOUNT_URL}/login?next=${next}`;
    }
  }, [session, role]);

  if (session === undefined) return null;
  if (!session || session.role !== role) return null;
  return <>{children}</>;
}
