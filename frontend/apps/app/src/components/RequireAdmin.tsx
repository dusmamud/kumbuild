"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";

// Admin pages ka guard — CLIENT SIDE (static export me server guard
// nahi hota). Session localStorage me check hoti hai; nahi ho to /login.
// Static HTML me dashboard ka markup pehle se hota hai (view-source me
// dikhega) — ye sirf UX guard hai, security nahi. Asli check backend
// karega (ARCHITECTURE.md Section 9).
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (getSession()) {
      setAllowed(true);
    } else {
      router.replace("/login");
    }
  }, [router]);

  if (!allowed) return null;
  return <>{children}</>;
}
