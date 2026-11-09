// Mock admin session — CLIENT SIDE ONLY (static export).
// Static Pages pe koi server nahi hai: na cookie padhi ja sakti hai, na
// server action chal sakta hai. Isliye session browser ke localStorage
// me hai (key "kb_session"). Sirf admin (Dus) login kar sakta hai —
// customer ka koi account nahi hai, isliye signup nahi hai.
// Ye guard sirf UX hai, security nahi — asli role check backend karega
// (ARCHITECTURE.md Section 9).
export type Role = "admin";

export interface Session {
  role: Role;
  name: string;
  email: string;
}

export const DEMO_ADMIN_EMAIL = "admin@kumbuild.com";

const SESSION_KEY = "kb_session";

function isValidSession(value: unknown): value is Session {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Session).role === "admin" &&
    typeof (value as Session).email === "string"
  );
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export type LoginResult =
  | { ok: true; session: Session }
  | { ok: false; error: "invalid-email" | "not-admin" };

export function login(email: string): LoginResult {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "invalid-email" };
  }
  if (normalized !== DEMO_ADMIN_EMAIL) {
    return { ok: false, error: "not-admin" };
  }
  const session: Session = {
    role: "admin",
    name: "Dus Mamud",
    email: DEMO_ADMIN_EMAIL,
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}
