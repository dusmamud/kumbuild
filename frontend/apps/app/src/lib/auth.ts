import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// MOCK AUTH — frontend phase only (ARCHITECTURE.md Section 5).
// Koi real authentication nahi hai, koi password kahin save/store NAHI hota.
// Login form jo password bhejta hai, use action turant discard kar deta hai.
// Asli session + role check backend aane pe banega. Frontend guard sirf UX hai.

export type Role = "customer" | "admin";

export interface Session {
  role: Role;
  name: string;
  email: string;
}

export const SESSION_COOKIE = "kb_session";

/** Demo admin account — mock me ye email admin banta hai. */
export const DEMO_ADMIN_EMAIL = "admin@kumbuild.com";
export const DEMO_CUSTOMER_EMAIL = "customer@example.com";

function encodeSession(s: Session): string {
  return Buffer.from(JSON.stringify(s), "utf-8").toString("base64url");
}

function decodeSession(value: string): Session | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf-8"),
    ) as Session;
    if (parsed.role !== "customer" && parsed.role !== "admin") return null;
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
 * Cookie domain: production me `.kumbuild.com` taaki ek login teeno
 * subdomains (auth/home/admin) par chale. Localhost par domain set nahi
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

/** Mock login: koi bhi email + koi bhi password chalta hai. */
export async function loginAction(formData: FormData): Promise<never> {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Password ko padhte hi nahi — mock me iski koi zaroorat nahi, aur ise
  // kahin save karna to bilkul mana hai.
  if (!email.includes("@")) {
    redirect("/login?error=invalid-email");
  }
  const isAdmin = email === DEMO_ADMIN_EMAIL;
  await setSessionCookie({
    role: isAdmin ? "admin" : "customer",
    name: isAdmin ? "Dus Mamud" : email.split("@")[0],
    email,
  });
  redirect(await dashboardUrl(isAdmin ? "admin" : "customer"));
}

/** Mock signup: account banta hai, turant customer login ho jata hai. */
export async function signupAction(formData: FormData): Promise<never> {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Password discard — mock.
  if (!name || !email.includes("@")) {
    redirect("/signup?error=invalid");
  }
  await setSessionCookie({ role: "customer", name, email });
  redirect(await dashboardUrl("customer"));
}

export async function logoutAction(): Promise<never> {
  "use server";
  await clearSessionCookie();
  redirect("/login");
}

/**
 * Role ke dashboard ka URL — host ke hisaab se:
 * - `auth.localhost:3000` -> `http://home.localhost:3000/`
 * - `auth.kumbuild.com` -> `https://home.kumbuild.com/`
 * - plain `localhost:3000` -> path fallback `/home` (README dekho)
 */
export async function dashboardUrl(role: Role): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const group = role === "admin" ? "admin" : "home";
  const bare = host.split(":")[0];
  const port = host.includes(":") ? `:${host.split(":")[1]}` : "";
  if (bare === "localhost" || bare === "127.0.0.1") {
    return `/${group}`;
  }
  const parts = bare.split(".");
  if (parts.length >= 2) {
    parts[0] = group;
    return `${proto}://${parts.join(".")}${port}/`;
  }
  return `/${group}`;
}
