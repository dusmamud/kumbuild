import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import AppHeader from "@/components/AppHeader";

// Admin dashboard layout — admin.kumbuild.com.
// Guard proxy me hai: sirf admin role; customer ko home bhej diya jata hai.
export default async function AdminShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("footer");
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader group="admin" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-muted">
        Kumbuild Admin — {t("tagline")}
      </footer>
    </div>
  );
}
