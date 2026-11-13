import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError, renderTurnstile, resetTurnstile } from "@kumbuild/lib";
import AuthLayout from "../components/AuthLayout";
import {
  ErrorBanner,
  Field,
  SuccessBanner,
  buttonPrimaryClass,
  inputClass,
  inputErrorClass,
} from "../components/ui";

// account.kumbuild.com/forgot-password — REAL backend:
// POST /api/auth/forgot-password. The backend always answers with the
// same generic 200 (account existence is never leaked), so a success
// here shows the same generic message; the reset email carries a
// /reset-password?token= link built from the backend's APP_BASE_URL.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const forgotSchema = z.object({
  email: z
    .string()
    .refine((v) => EMAIL_RE.test(v.trim()), "Enter a valid email address."),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const tokenRef = useRef("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  // Turnstile widget (dev: Cloudflare always-pass test site key).
  useEffect(() => {
    let cancelled = false;
    if (turnstileRef.current) {
      renderTurnstile(turnstileRef.current, (token) => {
        tokenRef.current = token;
      })
        .then((id) => {
          if (!cancelled) widgetIdRef.current = id;
        })
        .catch(() => {
          // Submit will surface the backend's turnstile error if attempted.
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  async function onValid(values: ForgotValues) {
    const normalized = values.email.trim().toLowerCase();
    if (!tokenRef.current) {
      setError("Please complete the verification check, then try again.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api.forgotPassword(normalized, tokenRef.current);
      setSent(true);
    } catch (err) {
      if (widgetIdRef.current !== null) resetTurnstile(widgetIdRef.current);
      tokenRef.current = "";
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold text-ink">
        Forgot password
      </h1>
      <p className="mt-1 text-sm text-muted">
        Enter your account email — we&apos;ll send a reset link if an account exists.
      </p>

      {error ? (
        <div className="mt-6">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      ) : null}
      {sent ? (
        <div className="mt-6">
          <SuccessBanner>
            If an account exists for this email, a reset link was sent.
          </SuccessBanner>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onValid)} className="mt-6 space-y-4" noValidate>
        <Field id="forgot-email" label="Email" error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
            className={`${inputClass} ${errors.email ? inputErrorClass : ""}`}
          />
        </Field>
        <div ref={turnstileRef} className="flex justify-center" />
        <button type="submit" className={buttonPrimaryClass} disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-5 text-sm text-muted">
        <Link to="/login" className="font-medium text-primary-700 hover:underline">
          Back to login
        </Link>
      </div>
    </AuthLayout>
  );
}
