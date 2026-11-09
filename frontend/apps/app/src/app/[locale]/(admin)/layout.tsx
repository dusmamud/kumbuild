import type { ReactNode } from "react";
import AdminShell from "@/components/AdminShell";
import RequireAdmin from "@/components/RequireAdmin";

// (admin) group — dashboard + orders/customers/builds/payments/settings.
// RequireAdmin client-side guard lagata hai: bina session ke /login.
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <RequireAdmin>{children}</RequireAdmin>
    </AdminShell>
  );
}
