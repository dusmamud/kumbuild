import { notFound } from "next/navigation";

// Site param — [site] dynamic segment: "auth" | "admin".
// Middleware (proxy.ts) host dekh ke is segment me rewrite karta hai,
// URL me ye segment kabhi nahi dikhta.
//
// NOTE (route groups wali koshish): pehle (auth)/(home)/(admin) route
// groups try kiye the, par Next.js build fail hota hai — "You cannot have
// two parallel pages that resolve to the same path" — kyunki groups
// me `/`, `/orders`, `/payments`, `/settings` same URL par resolve hote
// hain. Isliye [site] segment + src/sites/{auth,admin} modules:
// code ab bhi site ke hisaab se alag hai, routing segment se hoti hai.
//
// NOTE (2026-11-09, landing + admin only): customer dashboard (home)
// hata diya gaya — customer ka koi account nahi hai. Sirf admin login
// (auth) aur admin dashboard (admin) bache hain.
export type Site = "auth" | "admin";

export const SITES: Site[] = ["auth", "admin"];

export function isSite(value: string | undefined): value is Site {
  return value === "auth" || value === "admin";
}

/** Page sirf ek site ke liye hai — galat site ho to 404. */
export function assertSite(site: string | undefined, expected: Site): void {
  if (site !== expected) notFound();
}
