"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { buttonPrimaryClass, Field, inputClass } from "@/components/ui";

// Forgot password — /forgot-password (sirf admin ke liye).
// MOCK: koi email/OTP asal me nahi bheja jata. Form bharne par sent message
// dikhata hai (backend aane pe yahan reset link jayega).
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [email, setEmail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError(true);
      return;
    }
    setError(false);
    setSent(true);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Forgot password</h1>
      <p className="mt-1 text-sm text-muted">
        Apna admin email likho — reset link / OTP bhejenge (mock me kuch nahi
        bheja jata).
      </p>

      {error ? (
        <p className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error">
          Sahi email address likho.
        </p>
      ) : null}
      {sent ? (
        <p className="mt-4 rounded-lg bg-primary-tint px-3 py-2 text-sm font-medium text-primary-text">
          Mock hai — koi email nahi bheja gaya. Backend aane pe yahan reset
          link jayega.
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
        <button type="submit" className={`${buttonPrimaryClass} w-full`}>
          Send reset link
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-primary-text">
          Back to login
        </Link>
      </p>
    </div>
  );
}
