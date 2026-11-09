import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import AdminShell from "@/components/AdminShell";
import AuthShell from "@/components/AuthShell";
import { isSite, SITES } from "@/lib/site";

// [site] layout — site param ke hisaab se alag shell:
// auth -> beech me card (admin login), admin -> header + nav.
// Route groups is jagah kaam nahi karte (src/lib/site.ts me reason likha hai).
export function generateStaticParams() {
  return SITES.map((site) => ({ site }));
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  if (!isSite(site)) notFound();

  if (site === "auth") return <AuthShell>{children}</AuthShell>;
  return <AdminShell>{children}</AdminShell>;
}
