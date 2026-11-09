import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// MOCK AUTH — frontend phase only (ARCHITECTURE.md Section 5).
// Koi real authentication nahi hai, koi password kahin save/store NAHI hota.
// Login form jo password bhejta hai, use action turant discard kar deta hai.
// Asli session + role check backend aane pe banega. Frontend guard sirf UX hai.
//
// ADMIN-ONLY (2026-11-09, landing + admin only): sirf admin (Dus) login
// kar sakta hai — customer ka koi account nahi hai, isliye signup nahi hai.

export type Role = "admin";

export interface Session {
  role: Role;
  name: string;
  email: string;
}

export const SESSION_COOKIE = "kb_session";

/** Demo admin account — mock me sirf ye email login kar sakta hai. */
export const DEMO_ADMIN_EMAIL = "admin@kumbuild.com";

function encodeSession(s: Session): string {
  return Buffer.from(JSON.stringify(s), "utf-8").toString("base64url");
}

function decodeSession(value: string): Session | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf-8"),
    ) as Session;
    if (parsed.role !== "admin") return null;
    if (typeof parsed.email !== "string" || !parsed.email.includes("@"))
      return null;
    return {
      role: parsed.role,
      name: typeof parsed.name === "string" ? parsed.name : parsed.email,
      email: parsed.email,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

/**
 * Cookie domain: production me `.kumbuild.com` taaki ek login dono
 * subdomains (auth/admin) par chale. Localhost par domain set nahi
 * karte — host-only cookie, warna browser reject kar dega.
 */
async function cookieDomain(): Promise<string | undefined> {
  const host = (await headers()).get("host") ?? "";
  const bare = host.split(":")[0];
  if (bare.endsWith(".kumbuild.com") || bare === "kumbuild.com")
    return ".kumbuild.com";
  return undefined;
}

async function setSessionCookie(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 din
    domain: await cookieDomain(),
    secure: process.env.NODE_ENV === "production",
  });
}

async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Mock admin login: sirf admin@kumbuild.com chalta hai, baaki sab reject. */
export async function loginAction(formData: FormData): Promise<never> {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Password ko padhte hi nahi — mock me iski koi zaroorat nahi, aur ise
  // kahin save karna to bilkul mana hai.
  if (!email.includes("@")) {
    redirect("/login?error=invalid-email");
  }
  if (email !== DEMO_ADMIN_EMAIL) {
    redirect("/login?error=not-admin");
  }
  await setSessionCookie({
    role: "admin",
    name: "Dus Mamud",
    email,
  });
  redirect(await dashboardUrl());
}

/** Mock forgot-password: koi email asal me nahi bheja jata (backend aane pe). */
export async function forgotPasswordAction(
  formData: FormData,
): Promise<never> {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    redirect("/forgot-password?error=invalid-email");
  }
  redirect("/forgot-password?sent=1");
}

export async function logoutAction(): Promise<never> {
  "use server";
  await clearSessionCookie();
  redirect("/login");
}

/**
 * Admin dashboard ka URL — host ke hisaab se:
 * - `auth.localhost:3000` -> `http://admin.localhost:3000/`
 * - `auth.kumbuild.com` -> `https://admin.kumbuild.com/`
 * - plain `localhost:3000` -> path fallback `/admin` (README dekho)
 */
export async function dashboardUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const bare = host.split(":")[0];
  const port = host.includes(":") ? `:${host.split(":")[1]}` : "";
  if (bare === "localhost" || bare === "127.0.0.1") {
    return "/admin";
  }
  const parts = bare.split(".");
  if (parts.length >= 2) {
    parts[0] = "admin";
    return `${proto}://${parts.join(".")}${port}/`;
  }
  return "/admin";
}
