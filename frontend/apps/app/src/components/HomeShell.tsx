import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import AppHeader from "@/components/AppHeader";

// Customer dashboard layout — home.kumbuild.com.
// Guard proxy me hai: bina login ke yahan aane par /login redirect hota hai.
export default async function HomeShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("footer");
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader group="home" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-muted">
        Kumbuild — {t("tagline")}
      </footer>
    </div>
  );
}
