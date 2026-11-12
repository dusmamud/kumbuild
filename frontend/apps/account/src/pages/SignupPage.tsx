import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  cacheUser,
  fetchSession,
  renderTurnstile,
  resetTurnstile,
  type SignupInput,
} from "@kumbuild/lib";
import { redirectForRole } from "../lib/urls";
import AuthLayout from "../components/AuthLayout";
import {
  ErrorBanner,
  Field,
  SuccessBanner,
  buttonPrimaryClass,
  inputClass,
  inputErrorClass,
} from "../components/ui";

// account.kumbuild.com/signup — create a customer account (REAL backend).
// POST /api/auth/signup collects ONLY the essentials (name, email,
// password, phone, WhatsApp, optional alternative email) — NO billing
// address (removed 2026-11-12: minimal-field registration; billing is
// captured later). Signup emails a 6-digit OTP; the account stays
// "pending" until POST /api/auth/verify-email confirms the code, then
// the session works and the customer lands in the home app.
//
// Phone UX follows the GOV.UK phone pattern + Indian numbering rules:
// users type their 10-digit mobile however they know it (spaces, 0 or
// +91 prefix); the backend normalises to E.164 before storing.

const FRIENDLY_FIELD_ERRORS: Record<string, string> = {
  required: "This field is required.",
  "invalid-name": "Enter your full name (at least 2 characters).",
  "invalid-email": "Enter a valid email address, like you@example.com.",
  "invalid-phone":
    "Enter a valid 10-digit Indian mobile number, like 98765 43210.",
  "invalid-whatsapp":
    "Enter a valid WhatsApp number — an Indian mobile, or an international number with its country code (e.g. +1 …).",
  "invalid-alt-email": "Enter a valid email address, or leave this blank.",
  "alt-email-same-as-primary": "Use a different email from your main one, or leave this blank.",
  "weak-password":
    "Use at least 8 characters with an uppercase letter, a lowercase letter, a digit and a special character.",
};

function friendlyFieldError(code: string): string {
  return FRIENDLY_FIELD_ERRORS[code] ?? "Check this field.";
}

/** Grouped form section, matching the app's card/border language. */
function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-sm font-semibold tracking-wide text-ink">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export default function SignupPage() {
  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const [altEmail, setAltEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [existsError, setExistsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const tokenRef = useRef("");

  // Already logged in (per the backend)? Go straight to the role app.
  useEffect(() => {
    let live = true;
    fetchSession().then((session) => {
      if (live && session) redirectForRole(session.role);
    });
    return () => {
      live = false;
    };
  }, []);

  // Turnstile widget (dev: Cloudflare always-pass test site key).
  useEffect(() => {
    if (step !== "form" || !turnstileRef.current) return;
    let cancelled = false;
    renderTurnstile(turnstileRef.current, (token) => {
      tokenRef.current = token;
    })
      .then((id) => {
        if (!cancelled) widgetIdRef.current = id;
      })
      .catch(() => {
        // Submit will surface the backend's turnstile error if attempted.
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  function fieldError(key: string): string {
    return errors[key] ?? "";
  }

  function clearField(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function textField(
    key: string,
    label: string,
    value: string,
    set: (v: string) => void,
    opts: {
      type?: string;
      autoComplete?: string;
      placeholder?: string;
      optional?: boolean;
      hint?: string;
      inputMode?: "tel" | "email" | "numeric" | "text";
    } = {},
  ) {
    const err = fieldError(key);
    return (
      <Field label={opts.optional ? `${label} (optional)` : label} error={err} hint={opts.hint}>
        <input
          type={opts.type ?? "text"}
          autoComplete={opts.autoComplete}
          inputMode={opts.inputMode}
          placeholder={opts.placeholder}
          value={value}
          onChange={(e) => {
            set(e.target.value);
            clearField(key);
          }}
          className={`${inputClass} ${err ? inputErrorClass : ""}`}
        />
      </Field>
    );
  }

  /** Indian mobile field with a fixed +91 prefix treatment. */
  function phoneField(
    key: string,
    label: string,
    value: string,
    set: (v: string) => void,
    hint: string,
  ) {
    const err = fieldError(key);
    return (
      <Field label={label} error={err} hint={hint}>
        <div
          className={`${inputClass} flex items-center gap-2 p-0 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-600/30 ${
            err ? inputErrorClass : ""
          }`}
        >
          <span className="select-none border-r border-line py-2 pl-3 pr-2 font-medium text-muted">
            +91
          </span>
          <input
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            placeholder="98765 43210"
            value={value}
            onChange={(e) => {
              set(e.target.value);
              clearField(key);
            }}
            className="w-full bg-transparent py-2 pr-3 text-sm text-ink outline-none placeholder:text-faint"
          />
        </div>
      </Field>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setBanner("");
    setExistsError(false);
    // Client-side checks are typing feedback only — the server decides.
    const local: Record<string, string> = {};
    if (!name.trim()) local.full_name = FRIENDLY_FIELD_ERRORS.required;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      local.email = FRIENDLY_FIELD_ERRORS["invalid-email"];
    }
    if (!password) local.password = FRIENDLY_FIELD_ERRORS.required;
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }
    if (password !== confirm) {
      setErrors({ confirm: "Passwords do not match." });
      return;
    }
    if (!tokenRef.current) {
      setBanner("Please complete the verification check, then try again.");
      return;
    }
    const input: SignupInput = {
      full_name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone_no: phone.trim(),
      whatsapp_no: (sameAsPhone ? phone : whatsapp).trim(),
      turnstile_token: tokenRef.current,
    };
    if (altEmail.trim()) input.alternative_email = altEmail.trim().toLowerCase();

    setBusy(true);
    try {
      await api.signup(input);
      setOtpNotice(`We sent a 6-digit verification code to ${input.email}. Enter it below to finish.`);
      setStep("otp");
    } catch (err) {
      if (widgetIdRef.current !== null) resetTurnstile(widgetIdRef.current);
      tokenRef.current = "";
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === "exists") {
          setExistsError(true);
        } else if (err.code === "email-failed") {
          // The account row exists; only the mail failed. Resend works.
          setOtpNotice(
            "Your account was created, but the verification email could not be sent. Use “Resend code” below.",
          );
          setStep("otp");
        } else if (err.fields && Object.keys(err.fields).length > 0) {
          const mapped: Record<string, string> = {};
          for (const [key, code] of Object.entries(err.fields)) {
            mapped[key] = friendlyFieldError(code);
          }
          setErrors(mapped);
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

  async function verify(e: FormEvent) {
    e.preventDefault();
    setCodeError("");
    setBanner("");
    setBusy(true);
    try {
      const { user } = await api.verifyEmail(email.trim().toLowerCase(), code.trim());
      cacheUser(user);
      redirectForRole("customer");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "too-many-attempts") {
          setCodeError("Too many wrong attempts — this code is cancelled. Request a new code below.");
        } else if (err.code === "invalid-code") {
          setCodeError("That code doesn't match. Check the email and try again.");
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

  async function resend() {
    setCodeError("");
    setBanner("");
    setBusy(true);
    try {
      const { message } = await api.resendOtp(email.trim().toLowerCase());
      setOtpNotice(message === "" ? "A new code is on its way if your account is pending verification." : message);
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : "Could not resend the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "otp") {
    return (
      <AuthLayout>
        <h1 className="text-center font-display text-2xl font-semibold text-ink">
          Verify your email
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          One last step — confirm the code we emailed you.
        </p>

        {otpNotice ? (
          <div className="mt-6">
            <SuccessBanner>{otpNotice}</SuccessBanner>
          </div>
        ) : null}
        {banner ? (
          <div className="mt-6">
            <ErrorBanner>{banner}</ErrorBanner>
          </div>
        ) : null}

        <form onSubmit={verify} className="mt-6 space-y-4" noValidate>
          <Field label="6-digit code" error={codeError}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError("");
              }}
              className={`${inputClass} ${codeError ? inputErrorClass : ""}`}
            />
          </Field>
          <button type="submit" className={buttonPrimaryClass} disabled={busy}>
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Didn&apos;t get the code?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="font-medium text-primary-700 hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
        </p>
      </AuthLayout>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <AuthLayout>
      <h1 className="text-center font-display text-2xl font-semibold text-ink">
        Create your account
      </h1>
      <p className="mt-1 text-center text-sm text-muted">
        Sign up to order your website and track its progress with Kumbuild.
        It takes under a minute — we only ask for the essentials.
      </p>

      {existsError ? (
        <div className="mt-6">
          <ErrorBanner>
            An account with this email already exists —{" "}
            <Link to="/login" className="font-semibold underline underline-offset-2">
              log in instead
            </Link>
            .
          </ErrorBanner>
        </div>
      ) : null}
      {banner ? (
        <div className="mt-6">
          <ErrorBanner>{banner}</ErrorBanner>
        </div>
      ) : null}
      {errorCount > 0 ? (
        <div className="mt-6">
          <ErrorBanner>
            {errorCount === 1
              ? "Please fix the highlighted field below."
              : `Please fix the ${errorCount} highlighted fields below.`}
          </ErrorBanner>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-6" noValidate>
        <Section title="Your details">
          {textField("full_name", "Your name", name, setName, {
            autoComplete: "name",
            placeholder: "Ramesh Sharma",
          })}
          {textField("email", "Email", email, setEmail, {
            type: "email",
            autoComplete: "email",
            inputMode: "email",
            placeholder: "you@example.com",
            hint: "We email your verification code and order updates here.",
          })}
          <Field
            label="Password"
            hint="At least 8 characters, with an uppercase letter, a lowercase letter, a digit and a special character."
            error={fieldError("password")}
          >
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearField("password");
                }}
                className={`${inputClass} pr-16 ${fieldError("password") ? inputErrorClass : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-2 px-2 text-xs font-medium text-primary-700 hover:underline"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
          <Field label="Confirm password" error={fieldError("confirm")}>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                clearField("confirm");
              }}
              className={`${inputClass} ${fieldError("confirm") ? inputErrorClass : ""}`}
            />
          </Field>
        </Section>

        <Section title="Contact">
          {phoneField(
            "phone_no",
            "Mobile number",
            phone,
            setPhone,
            "Your 10-digit Indian mobile — for order updates and support calls.",
          )}
          <label className="flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={sameAsPhone}
              onChange={(e) => {
                setSameAsPhone(e.target.checked);
                if (e.target.checked) clearField("whatsapp_no");
              }}
              className="h-4 w-4 rounded border-line"
            />
            WhatsApp number is the same as my mobile number
          </label>
          {!sameAsPhone
            ? phoneField(
                "whatsapp_no",
                "WhatsApp number",
                whatsapp,
                setWhatsapp,
                "We share design previews and progress on WhatsApp.",
              )
            : null}
          {textField("alternative_email", "Alternative email", altEmail, setAltEmail, {
            type: "email",
            autoComplete: "email",
            inputMode: "email",
            placeholder: "other@example.com",
            optional: true,
            hint: "A backup email, in case you lose access to your main one.",
          })}
        </Section>

        <div ref={turnstileRef} className="flex justify-center" />
        <button type="submit" className={buttonPrimaryClass} disabled={busy}>
          {busy ? "Creating account…" : "Sign up"}
        </button>
        <p className="text-center text-xs text-muted">
          We&apos;ll email you a 6-digit code to verify your address — no
          payment or billing details are needed to sign up.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
