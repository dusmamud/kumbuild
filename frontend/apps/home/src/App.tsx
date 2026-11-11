import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider, localeFromPath, localePrefix } from "./lib/i18n";
import RequireRole from "./components/RequireRole";
import DashboardPage from "./pages/DashboardPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import ProfilePage from "./pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";

// home.kumbuild.com — customer dashboard (mock data).
// en-US has no URL prefix; hi -> /hi/..., bn -> /bn/...
export default function App() {
  const locale = localeFromPath(window.location.pathname);
  return (
    <LocaleProvider locale={locale}>
      <BrowserRouter basename={localePrefix(locale) || "/"}>
        <RequireRole role="customer">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </RequireRole>
      </BrowserRouter>
    </LocaleProvider>
  );
}
