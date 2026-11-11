import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider, localeFromPath, localePrefix } from "./lib/i18n";
import RequireRole from "./components/RequireRole";
import AdminShell from "./components/AdminShell";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import NewOrderPage from "./pages/NewOrderPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import CustomersPage from "./pages/CustomersPage";
import BuildsPage from "./pages/BuildsPage";
import PaymentsPage from "./pages/PaymentsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";

// admin.kumbuild.com — Vite port of the Next.js admin app (mock data).
// en-US has no URL prefix; hi -> /hi/..., bn -> /bn/...
export default function App() {
  const locale = localeFromPath(window.location.pathname);
  return (
    <LocaleProvider locale={locale}>
      <BrowserRouter basename={localePrefix(locale) || "/"}>
        <RequireRole role="admin">
          <AdminShell>
            <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/new" element={<NewOrderPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/builds" element={<BuildsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AdminShell>
        </RequireRole>
      </BrowserRouter>
    </LocaleProvider>
  );
}
