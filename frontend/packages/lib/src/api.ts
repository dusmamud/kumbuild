// Real API client for the Go backend (backend/README.md §5/§6) — replaces
// the mock-auth phase for AUTH only. Catalogue/order demo data still lives
// in mock.ts.
//
// Base URL: VITE_API_BASE_URL (see frontend/apps/*/.env.production). In dev
// this is the Cloudflare Quick Tunnel URL of the VPS — it CHANGES on every
// cloudflared/VPS restart; update .env.production and redeploy then.
//
// Contract notes (from backend/internal/server + handlers):
// - All auth calls are POSTs under /api/auth/*, JSON in/out, session is the
//   HttpOnly `kb_session` cookie — every fetch uses credentials:"include".
// - CSRF is double-submit (backend §6.5): GET /api/auth/csrf sets a
//   `csrf_token` cookie (NOT HttpOnly) AND returns the same token in its
//   JSON body; the client sends that value as the X-CSRF-Token header on
//   every state-changing request. The body value is the primary source:
//   cross-origin JS (dev apps on *.pages.dev, API on a trycloudflare
//   host) cannot read the API host's cookie from document.cookie, but the
//   browser still sends the cookie back automatically on credentialed
//   fetches, so the backend's header==cookie check passes. The cookie
//   read below remains as a same-site (prod) fallback.
// - Error envelope: { error: string, message: string, fields?: Record<string,string> }.
// - Turnstile is required on signup/login/forgot/reset/accept-invite.
//   Dev uses Cloudflare's always-pass TEST site key below (the backend
//   uses the matching always-pass test secret in dev).

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const API_BASE_URL = (viteEnv.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export const TURNSTILE_SITE_KEY =
  viteEnv.VITE_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

export type ApiRole = "super_admin" | "admin" | "customer_service" | "customer";
export type ApiUserStatus = "active" | "pending" | "invited" | "disabled";

export interface ApiUser {
  id: string;
  full_name: string;
  email: string;
  phone_no: string;
  whatsapp_no: string;
  alternative_email?: string;
  role: ApiRole;
  status: ApiUserStatus;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiBillingAddress {
  id: string;
  user_id: string;
  billing_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstin?: string;
}

export interface MeResponse {
  user: ApiUser;
  billing_address: ApiBillingAddress | null;
}

/** Flat signup payload — field names are the backend's §2 set, verbatim. */
export interface SignupInput {
  full_name: string;
  email: string;
  password: string;
  phone_no: string;
  whatsapp_no: string;
  alternative_email?: string;
  billing_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstin?: string;
  turnstile_token: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Token from the last /api/auth/csrf JSON body (primary CSRF source). */
let csrfTokenFromBody: string | null = null;

/**
 * GET /api/auth/csrf — (re)issues the csrf_token cookie and returns the
 * same token in the JSON body, which is what we keep for the header:
 * cross-origin document.cookie cannot see the API host's cookie.
 */
async function ensureCsrf(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/csrf`, { credentials: "include" });
    const data: unknown = await res.json().catch(() => null);
    const token = (data as { csrf_token?: unknown } | null)?.csrf_token;
    if (typeof token === "string" && token !== "") csrfTokenFromBody = token;
  } catch {
    // Network failure: the real request below will surface the error.
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? "GET";
  if (method !== "GET") {
    // Session creation rotates the CSRF token, so always refresh first.
    await ensureCsrf();
  }
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const csrf = csrfTokenFromBody ?? readCsrfCookie();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Could not reach the Kumbuild server. Check your connection and try again.");
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; message?: string; fields?: Record<string, string> };
    throw new ApiError(
      res.status,
      err.error ?? "error",
      err.message ?? `Request failed (${res.status})`,
      err.fields,
    );
  }
  return data as T;
}

export const api = {
  signup(input: SignupInput): Promise<{ user: ApiUser }> {
    return request("/api/auth/signup", { method: "POST", body: input });
  },
  verifyEmail(email: string, code: string): Promise<{ user: ApiUser }> {
    return request("/api/auth/verify-email", { method: "POST", body: { email, code } });
  },
  resendOtp(email: string): Promise<{ message: string }> {
    return request("/api/auth/resend-otp", { method: "POST", body: { email } });
  },
  login(email: string, password: string, turnstileToken: string): Promise<{ user: ApiUser }> {
    return request("/api/auth/login", {
      method: "POST",
      body: { email, password, turnstile_token: turnstileToken },
    });
  },
  logout(): Promise<{ message: string }> {
    return request("/api/auth/logout", { method: "POST", body: {} });
  },
  me(): Promise<MeResponse> {
    return request("/api/auth/me");
  },
  forgotPassword(email: string, turnstileToken: string): Promise<{ message: string }> {
    return request("/api/auth/forgot-password", {
      method: "POST",
      body: { email, turnstile_token: turnstileToken },
    });
  },
  resetPassword(token: string, newPassword: string, turnstileToken: string): Promise<{ message: string }> {
    return request("/api/auth/reset-password", {
      method: "POST",
      body: { token, newPassword, turnstile_token: turnstileToken },
    });
  },
  acceptInvite(token: string, newPassword: string, turnstileToken: string): Promise<{ user: ApiUser }> {
    return request("/api/auth/accept-invite", {
      method: "POST",
      body: { token, newPassword, turnstile_token: turnstileToken },
    });
  },
  changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  },
};

// --- Cloudflare Turnstile (explicit render) --------------------------------

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => number;
  reset: (id: number) => void;
  remove: (id: number) => void;
}

let turnstileScript: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as unknown as { turnstile?: TurnstileApi };
  if (w.turnstile) return Promise.resolve();
  if (!turnstileScript) {
    turnstileScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("turnstile script failed to load"));
      document.head.appendChild(script);
    });
  }
  return turnstileScript;
}

/** Render the Turnstile widget into el; resolves with the widget id. */
export async function renderTurnstile(el: HTMLElement, onToken: (token: string) => void): Promise<number> {
  await loadTurnstileScript();
  const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  if (!ts) throw new Error("turnstile unavailable");
  return ts.render(el, {
    sitekey: TURNSTILE_SITE_KEY,
    callback: onToken,
    "expired-callback": () => onToken(""),
    "error-callback": () => onToken(""),
  });
}

export function resetTurnstile(id: number): void {
  const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  ts?.reset(id);
}
