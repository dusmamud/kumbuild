import { notFound } from "next/navigation";

// Site param — [site] dynamic segment: "auth" | "home" | "admin".
// Middleware (proxy.ts) host dekh ke is segment me rewrite karta hai,
// URL me ye segment kabhi nahi dikhta.
//
// NOTE (route groups wali koshish): pehle (auth)/(home)/(admin) route
// groups try kiye the, par Next.js build fail hota hai — "You cannot have
// two parallel pages that resolve to the same path" — kyunki teeno groups
// me `/`, `/orders`, `/payments`, `/settings` same URL par resolve hote
// hain. Isliye [site] segment + src/sites/{auth,home,admin} modules:
// code ab bhi site ke hisaab se alag hai, routing segment se hoti hai.
export type Site = "auth" | "home" | "admin";

export const SITES: Site[] = ["auth", "home", "admin"];

export function isSite(value: string | undefined): value is Site {
  return value === "auth" || value === "home" || value === "admin";
}

/** Page sirf ek site ke liye hai — galat site ho to 404. */
export function assertSite(site: string | undefined, expected: Site): void {
  if (site !== expected) notFound();
}
