import { useEffect, useState, type ReactNode } from "react";
import { acceptDemoSession, getSession, type Role, type Session } from "@kumbuild/lib";
import { ACCOUNT_URL } from "../lib/urls";

/**
 * Route guard (mock phase, UX only — NOT security).
 * Accepts the DEMO ONLY ?demo_session= handoff FIRST (it writes the
 * session to localStorage), then reads the session into state so the
 * first render after the handoff shows the app instead of a blank page.
 * No session (or wrong role) -> central login on account.kumbuild.com.
 * Real role enforcement happens in the Go backend, per API call.
 */
export default function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    acceptDemoSession();
    setSession(getSession());
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
