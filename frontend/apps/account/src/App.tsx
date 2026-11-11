import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LocaleProvider, localeFromPath, localePrefix } from "./lib/i18n";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import NotFoundPage from "./pages/NotFoundPage";

// account.kumbuild.com — central login/signup (mock phase).
// en-US has no URL prefix; hi -> /hi/..., bn -> /bn/...
export default function App() {
  const locale = localeFromPath(window.location.pathname);
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
    </LocaleProvider>
  );
}
