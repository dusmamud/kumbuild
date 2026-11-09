import { notFound } from "next/navigation";
import AdminPaymentsPage from "@/sites/admin/PaymentsPage";
import HomePaymentsPage from "@/sites/home/PaymentsPage";
import { isSite } from "@/lib/site";

// Payments — home: meri payments; admin: saari payments.
export default async function PaymentsRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  if (!isSite(site)) notFound();
  if (site === "admin") return <AdminPaymentsPage />;
  if (site === "home") return <HomePaymentsPage />;
  notFound();
}
