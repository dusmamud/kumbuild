// App URLs — production subdomains by default, overridable per env
// (.env.development points them at the local dev ports).
export const ACCOUNT_URL =
  import.meta.env.VITE_ACCOUNT_URL ?? "https://account.kumbuild.com";
export const ADMIN_URL =
  import.meta.env.VITE_ADMIN_URL ?? "https://admin.kumbuild.com";
export const HOME_URL =
  import.meta.env.VITE_HOME_URL ?? "https://home.kumbuild.com";
export const WEB_URL =
  import.meta.env.VITE_WEB_URL ?? "https://kumbuild.com";

/** Redirect to the app that matches the session role (mock phase: full page load). */
export function redirectForRole(role: "admin" | "customer", demoSession?: string): void {
  const base = role === "admin" ? ADMIN_URL : HOME_URL;
  const suffix = demoSession ? `?demo_session=${demoSession}` : "";
  window.location.href = `${base}/${suffix}`;
}
