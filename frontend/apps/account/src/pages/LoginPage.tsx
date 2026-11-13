import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  api,
  ApiError,
  cacheUser,
  fetchSession,
  logout,
  renderTurnstile,
  resetTurnstile,
  sessionForUser,
  type Session,
} from "@kumbuild/lib";
import { ADMIN_URL, HOME_URL, redirectForRole } from "../lib/urls";
import AuthLayout from "../components/AuthLayout";
import {
  ErrorBanner,
  Field,
  PasswordInput,
  buttonPrimaryClass,
  inputClass,
  inputErrorClass,
} from "../components/ui";

// account.kumbuild.com/login — central login (REAL backend).
// POST /api/auth/login (Go API, session cookie). Success: role app
// (staff -> admin app, customer -> home app); the sibling apps validate
// the same cookie themselves via /api/auth/me, so no session handoff is
// needed. ?next= overrides the role default: a relative path goes to the
// role app, an absolute URL is honoured only if it is on the admin/home
// app origin.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same rules and messages as the hand-rolled checks before: a bad or
// missing email gets one message, a missing password another.
const loginSchema = z.object({
  email: z
    .string()
    .refine((v) => EMAIL_RE.test(v.trim()), "Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

function redirectAfterLogin(session: Session, next: string | null): void {
  const base = session.role === "admin" ? ADMIN_URL : HOME_URL;
  if (next) {
    if (next.startsWith("/") && !next.startsWith("//")) {
      window.location.href = `${base}${next}`;
      return;
    }
    try {
      const url = new URL(next);
      const allowed = [new URL(ADMIN_URL).origin, new URL(HOME_URL).origin];
      if (allowed.includes(url.origin)) {
        window.location.href = url.toString();
        return;
      }
    } catch {
      // Not a valid URL — fall through to the role default.
    }
  }
  redirectForRole(session.role);
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const bannerRef = useRef<HTMLParagraphElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const tokenRef = useRef("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
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
          // Widget failed to load — submit will surface the backend's
          // turnstile-required error if attempted without a token.
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Move focus to the banner when a server error appears (401 etc.):
  // validation errors already focus their field; the banner was the
  // only error surface that left focus on BODY.
  useEffect(() => {
    if (banner) bannerRef.current?.focus();
  }, [banner]);

  // Already logged in? Ask the backend (/me) — skip the form and go
  // straight to the role app. Except after an explicit logout
  // (?logged_out=1): end the server session and show the form instead
  // of bouncing straight back.
  useEffect(() => {
    if (searchParams.get("logged_out") === "1") {
      void logout();
      const next = new URLSearchParams(searchParams);
      next.delete("logged_out");
      const qs = next.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      return;
    }
    let live = true;
    fetchSession().then((session) => {
      if (live && session) {
        redirectAfterLogin(session, searchParams.get("next"));
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onValid(values: LoginValues) {
    setBanner("");
    if (!tokenRef.current) {
      setBanner("Please complete the verification check, then try again.");
      return;
    }
    const normalized = values.email.trim().toLowerCase();
    setBusy(true);
    try {
      const { user } = await api.login(normalized, values.password, tokenRef.current);
      cacheUser(user);
      redirectAfterLogin(sessionForUser(user), searchParams.get("next"));
    } catch (err) {
      // Turnstile tokens are single-use — reset for the next attempt.
      // Form data stays put (react-hook-form keeps the values).
      if (widgetIdRef.current !== null) resetTurnstile(widgetIdRef.current);
      tokenRef.current = "";
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setBanner(
            "Invalid email or password. If you just signed up, verify your email first — unverified accounts can't log in.",
          );
        } else if (err.fields?.password) {
          setError("password", { type: "server", message: err.message });
        } else {
          setBanner(err.message);
        }
      } else {
        setBanner("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold text-ink">
        Log in to Kumbuild
      </h1>
      <p className="mt-1 text-sm text-muted">Log in to continue to Kumbuild.</p>

      {banner ? (
        <div className="mt-6">
          <ErrorBanner ref={bannerRef}>{banner}</ErrorBanner>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onValid)} className="mt-6 space-y-4" noValidate>
        <Field id="login-email" label="Email" error={errors.email?.message}>
          <input
            type="email"
            autoComplete="username webauthn"
            placeholder="you@example.com"
            {...register("email")}
            className={`${inputClass} ${errors.email ? inputErrorClass : ""}`}
          />
        </Field>
        <Field
          id="login-password"
          label="Password"
          error={errors.password?.message}
          labelAction={
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary-700 hover:underline"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            show={showPassword}
            onToggleShow={() => setShowPassword((v) => !v)}
            autoComplete="current-password"
            placeholder="••••••••"
            {...register("password")}
            className={errors.password ? inputErrorClass : ""}
          />
        </Field>
        <div ref={turnstileRef} className="flex justify-center" />
        <button type="submit" className={buttonPrimaryClass} disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-5 text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-medium text-primary-700 hover:underline">
          Sign up
        </Link>
      </div>
    </AuthLayout>
  );
}
