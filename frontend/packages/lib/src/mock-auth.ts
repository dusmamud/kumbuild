// Mock auth — CLIENT SIDE ONLY, frontend phase.
// Static Pages pe koi server nahi hai: na cookie padhi ja sakti hai, na
// session verify ho sakta hai. Isliye session browser ke localStorage me
// hai (key "kb_session"). Ye guard sirf UX hai, security NAHI — asli
// role/session check Go backend karega (har API call pe).
//
// Mock users:
// - admin@kumbuild.com (koi bhi password) -> admin (Dus Mamud)
// - mock customers (packages/lib mock.ts) -> customer role
// - signup: naya customer localStorage (kb_users) me banta hai.
//
// Cross-app demo handoff (DEMO ONLY): localStorage per-origin hota hai,
// isliye account app se admin/home app tak session URL se jaata hai
// (?demo_session=<base64>). Receiving app use turant localStorage me
// likh ke URL se hata deti hai. Production me iski jagah Go backend ka
// HttpOnly cookie (Domain=.kumbuild.com) aayega — ye handoff kabhi
// production auth nahi banega.

import { getCustomerByEmail, type Customer } from "./mock";

export type Role = "admin" | "customer";

export interface Session {
  role: Role;
  name: string;
  email: string;
}

export const DEMO_ADMIN_EMAIL = "admin@kumbuild.com";

const SESSION_KEY = "kb_session";
const USERS_KEY = "kb_users";

interface StoredUser {
  name: string;
  email: string;
  password: string;
}

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(window.localStorage.getItem(USERS_KEY) ?? "[]") as StoredUser[];
  } catch {
    return [];
  }
}

function isValidSession(value: unknown): value is Session {
  return (
    typeof value === "object" &&
    value !== null &&
    ((value as Session).role === "admin" || (value as Session).role === "customer") &&
    typeof (value as Session).email === "string" &&
    typeof (value as Session).name === "string"
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

function saveSession(session: Session): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export type LoginResult =
  | { ok: true; session: Session }
  | { ok: false; error: "invalid-email" | "short-password" | "not-found" | "wrong-password" };

export function login(email: string, password: string): LoginResult {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "invalid-email" };
  }
  if (password.length < 6) {
    return { ok: false, error: "short-password" };
  }
  if (normalized === DEMO_ADMIN_EMAIL) {
    const session: Session = { role: "admin", name: "Dus Mamud", email: DEMO_ADMIN_EMAIL };
    saveSession(session);
    return { ok: true, session };
  }
  const customer: Customer | undefined = getCustomerByEmail(normalized);
  if (customer) {
    const session: Session = { role: "customer", name: customer.name, email: customer.email };
    saveSession(session);
    return { ok: true, session };
  }
  const stored = readUsers().find((u) => u.email === normalized);
  if (!stored) {
    return { ok: false, error: "not-found" };
  }
  if (stored.password !== password) {
    return { ok: false, error: "wrong-password" };
  }
  const session: Session = { role: "customer", name: stored.name, email: stored.email };
  saveSession(session);
  return { ok: true, session };
}

export type SignupResult =
  | { ok: true; session: Session }
  | { ok: false; error: "invalid-email" | "short-password" | "invalid-name" | "exists" };

export function signup(name: string, email: string, password: string): SignupResult {
  const normalized = email.trim().toLowerCase();
  if (name.trim().length < 2) {
    return { ok: false, error: "invalid-name" };
  }
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "invalid-email" };
  }
  if (password.length < 6) {
    return { ok: false, error: "short-password" };
  }
  if (normalized === DEMO_ADMIN_EMAIL || getCustomerByEmail(normalized)) {
    return { ok: false, error: "exists" };
  }
  const users = readUsers();
  if (users.some((u) => u.email === normalized)) {
    return { ok: false, error: "exists" };
  }
  users.push({ name: name.trim(), email: normalized, password });
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  const session: Session = { role: "customer", name: name.trim(), email: normalized };
  saveSession(session);
  return { ok: true, session };
}

/** DEMO ONLY handoff: session ko base64 (URL-safe) me pack karo. */
export function encodeDemoSession(session: Session): string {
  const payload = { ...session, exp: Date.now() + 5 * 60 * 1000 };
  return btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/**
 * DEMO ONLY handoff: current URL se ?demo_session= padho, valid ho to
 * session save karo aur param hata do. Invalid/expired -> null.
 */
export function acceptDemoSession(): Session | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("demo_session");
  if (!raw) return null;
  params.delete("demo_session");
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", next);
  try {
    const parsed: unknown = JSON.parse(atob(raw.replaceAll("-", "+").replaceAll("_", "/")));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { exp?: unknown }).exp === "number" &&
      (parsed as { exp: number }).exp > Date.now()
    ) {
      const { exp: _exp, ...session } = parsed as Session & { exp: number };
      if (isValidSession(session)) {
        saveSession(session);
        return session;
      }
    }
  } catch {
    // invalid handoff — ignore
  }
  return null;
}
