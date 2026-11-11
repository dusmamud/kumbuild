// App URLs — production subdomains by default, overridable per env
// (.env.development points them at the local dev ports).
// Mock phase: custom domains (kumbuild.com) abhi khareede nahi gaye,
// isliye live Pages deploy (https://*.pages.dev) pe redirect sibling
// *.pages.dev URLs pe jata hai. Domain khareedne + custom domain lagne
// ke baad ye branch kabhi chalegi nahi (hostname *.pages.dev nahi hoga).
function pagesDevUrl(project: string): string | null {
  if (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".pages.dev")
  ) {
    return `https://${project}.pages.dev`;
  }
  return null;
}

export const ACCOUNT_URL =
  import.meta.env.VITE_ACCOUNT_URL ??
  pagesDevUrl("kumbuild-account") ??
  "https://account.kumbuild.com";
export const ADMIN_URL =
  import.meta.env.VITE_ADMIN_URL ??
  pagesDevUrl("kumbuild-admin") ??
  "https://admin.kumbuild.com";
export const HOME_URL =
  import.meta.env.VITE_HOME_URL ??
  pagesDevUrl("kumbuild-home") ??
  "https://home.kumbuild.com";
export const WEB_URL =
  import.meta.env.VITE_WEB_URL ??
  pagesDevUrl("kumbuild-web") ??
  "https://kumbuild.com";

/** Redirect to the app that matches the session role (mock phase: full page load). */
export function redirectForRole(role: "admin" | "customer", demoSession?: string): void {
  const base = role === "admin" ? ADMIN_URL : HOME_URL;
  const suffix = demoSession ? `?demo_session=${demoSession}` : "";
  window.location.href = `${base}/${suffix}`;
}
