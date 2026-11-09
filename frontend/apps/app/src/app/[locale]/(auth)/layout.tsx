import type { ReactNode } from "react";
import AuthShell from "@/components/AuthShell";

// (auth) group — /login, /forgot-password. Route groups URL me nahi
// aate, sirf layout (AuthShell) ke liye hain.
export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
