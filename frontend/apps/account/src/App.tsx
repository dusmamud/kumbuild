import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { LocaleProvider, localeFromPath, localePrefix } from "./lib/i18n";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import NotFoundPage from "./pages/NotFoundPage";

// account.kumbuild.com — central login/signup (mock phase).
// en-US has no URL prefix; hi -> /hi/..., bn -> /bn/...
export default function App() {
  const locale = localeFromPath(window.location.pathname);
  // Sonner's theme follows the app's data-theme toggle, NOT the OS:
  // observe the <html> data-theme attribute so the toast flips when
  // the user toggles theme mid-session.
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    const el = document.documentElement;
    const sync = () =>
      setTheme(el.dataset.theme === "dark" ? "dark" : "light");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return (
    <LocaleProvider locale={locale}>
      <BrowserRouter basename={localePrefix(locale) || "/"}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      {/* Mounted once: toasts are ONLY for transient confirmations
          (e.g. OTP resend) — form errors stay inline in banners/fields. */}
      <Toaster position="top-center" theme={theme} />
    </LocaleProvider>
  );
}
