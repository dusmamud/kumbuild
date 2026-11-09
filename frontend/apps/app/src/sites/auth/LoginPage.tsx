"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DEMO_ADMIN_EMAIL, getSession, login } from "@/lib/auth";
import { Link, useRouter } from "@/i18n/navigation";
import { buttonGhostClass, buttonPrimaryClass, Field, inputClass } from "@/components/ui";

// Admin login — /login (SUBDOMAINS.md Section 2).
// MOCK, CLIENT SIDE: sirf admin@kumbuild.com login kar sakta hai.
// Password kahin save/store nahi hota — form use padhta hi nahi.
// Customer ka yahan koi kaam nahi hai — na signup hai, na customer login.
export default function LoginPage() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [error, setError] = useState<"" | "invalid-email" | "not-admin">("");
  const [email, setEmail] = useState("");

  // Pehle se logged-in admin dobara login page na dekhe — dashboard pe bhejo.
  useEffect(() => {
    if (getSession()) {
      router.replace("/");
    }
  }, [router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = login(email);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/");
  }

  function demo() {
    login(DEMO_ADMIN_EMAIL);
    router.push("/");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("login")}</h1>
      <p className="mt-1 text-sm text-muted">
        Kumbuild Admin — sirf admin (Dus) login kar sakta hai.
      </p>

      {error === "invalid-email" ? (
        <p className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error">
          Sahi email address likho.
        </p>
      ) : null}
      {error === "not-admin" ? (
        <p className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error">
          Sirf admin login kar sakta hai — admin@kumbuild.com se login karo.
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="admin@kumbuild.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={inputClass}
          />
        </Field>
        <button type="submit" className={`${buttonPrimaryClass} w-full`}>
          Login
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-xs font-semibold text-muted">
          MOCK LOGIN — demo ke liye (koi real password nahi):
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={demo} className={buttonGhostClass}>
            Demo admin
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/forgot-password" className="font-semibold text-primary-text">
          Password bhool gaye?
        </Link>
      </p>
    </div>
  );
}
