// Real session layer on top of ./api — replaces mock-auth.
//
// Auth truth is the backend's HttpOnly `kb_session` cookie + GET
// /api/auth/me (fetchSession). What lives in localStorage ("kb_user") is
// only a display cache of the last /me profile (name/email/role) so
// headers and pages can render synchronously; it grants nothing — every
// app re-validates with fetchSession() on load (see RequireRole), and a
// 401 from /me clears the cache.
//
// App-level Role stays "admin" | "customer" (the shape the apps were
// built against): the backend staff roles (super_admin, admin,
// customer_service) all map to "admin"; only "customer" maps to
// "customer". The backend still enforces the exact role per API call.

import { api, ApiError, type ApiUser } from "./api";

export type Role = "admin" | "customer";

export interface Session {
  role: Role;
  name: string;
  email: string;
}

const USER_KEY = "kb_user";

export function roleForUser(user: ApiUser): Role {
  return user.role === "customer" ? "customer" : "admin";
}

export function sessionForUser(user: ApiUser): Session {
  return { role: roleForUser(user), name: user.full_name, email: user.email };
}

export function cacheUser(user: ApiUser | null): void {
  if (typeof window === "undefined") return;
  if (user === null) {
    window.localStorage.removeItem(USER_KEY);
  } else {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getCachedUser(): ApiUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as ApiUser).email === "string" &&
      typeof (parsed as ApiUser).full_name === "string" &&
      typeof (parsed as ApiUser).role === "string"
    ) {
      return parsed as ApiUser;
    }
    return null;
  } catch {
    return null;
  }
}

/** Synchronous display session from the /me cache (NOT an auth check). */
export function getSession(): Session | null {
  const user = getCachedUser();
  return user ? sessionForUser(user) : null;
}

/**
 * Authoritative session: asks the backend (/api/auth/me). 401 clears the
 * cache and returns null. On a network error the cached session is kept
 * (dev tunnel hiccups should not log the user out visually) — the next
 * successful /me corrects it.
 */
export async function fetchSession(): Promise<Session | null> {
  try {
    const { user } = await api.me();
    cacheUser(user);
    return sessionForUser(user);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      cacheUser(null);
      return null;
    }
    return getSession();
  }
}

/** Real logout: deletes the server session, then clears the cache. */
export async function logout(): Promise<void> {
  try {
    await api.logout();
  } catch {
    // Even if the API call fails, the local cache must go.
  }
  cacheUser(null);
}
