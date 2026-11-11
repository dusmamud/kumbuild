import type { ReactNode } from "react";
import AppHeader from "./AppHeader";

// Admin dashboard layout — admin.kumbuild.com.
// Guard RequireRole (App.tsx) me hai: bina session ke account app ka
// /login. Ported from the Next.js app's AdminShell.tsx.
export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-muted">
        Kumbuild Admin — Tell us what to build.
      </footer>
    </div>
  );
}
