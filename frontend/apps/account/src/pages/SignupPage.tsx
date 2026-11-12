import { useEffect, useRef, useState, type FormEvent } from "react";
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
// MULTI-STEP "slide" flow (2026-11-12): one short step at a time instead
// of one long page — 1) Your details, 2) Create password, 3) Contact —
// then the email-OTP stage as the final verify step. The steps are pure
// frontend state: ONE POST /api/auth/signup still sends the full payload
// (name, email, password, phone, WhatsApp, optional alternative email;
// NO billing address — removed 2026-11-12). Signup emails a 6-digit OTP;
// the account stays "pending" until POST /api/auth/verify-email
// confirms the code, then the session works and the customer lands in
// the home app.
//
// Phone UX follows the GOV.UK phone pattern + Indian numbering rules:
// users type their 10-digit mobile however they know it (spaces, 0 or
// +91 prefix); the backend normalises to E.164 before storing. The
// per-step client checks below only mirror the server rules for fast
// feedback — the server stays authoritative, and its field errors route
// the user back to the step that owns the field.

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password rules mirror backend/internal/auth ValidatePasswordPolicy —
// shown as a live checklist on step 2 (NN/g: disclose constraints up
// front, tick them as the user satisfies them).
const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: "At least 8 characters", test: (p) => [...p].length >= 8 },
  { label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "A digit", test: (p) => /\d/.test(p) },
  { label: "A special character (e.g. ! @ # $)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

/** Client mirror of the backend's NormalizeIndianMobile shape check. */
function isValidIndianMobile(raw: string): boolean {
  let d = raw.replace(/[\s()\-]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.startsWith("0091")) d = d.slice(4);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d);
}

/** WhatsApp: an Indian mobile, or a strict international E.164 number. */
function isValidWhatsApp(raw: string): boolean {
  if (isValidIndianMobile(raw)) return true;
  return /^\+[1-9]\d{7,14}$/.test(raw.replace(/[\s()\-]/g, ""));
}

// Which form step owns each payload field — used both for per-step
// validation and for routing server field errors back to their step.
const STEP_FIELDS: Record<number, string[]> = {
  0: ["full_name", "email"],
  1: ["password", "confirm"],
  2: ["phone_no", "whatsapp_no", "alternative_email"],
};
const FIELD_STEP: Record<string, number> = Object.fromEntries(
  Object.entries(STEP_FIELDS).flatMap(([step, fields]) =>
    fields.map((f) => [f, Number(step)] as const),
  ),
);
const STEP_LABELS = ["Details", "Password", "Contact", "Verify"];
const STEP_HEADINGS = ["Your details", "Create password", "Contact"];

const buttonGhostClass =
  "inline-flex w-full items-center justify-center rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-50";

/** Progress indicator shown on every stage, OTP included (step 4). */
function Progress({ current }: { current: number }) {
  return (
    <div className="mt-6">
      <ol className="flex items-center gap-2" aria-label="Sign up progress">
        {STEP_LABELS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-primary-600 text-white"
                    : active
                      ? "bg-primary-600 text-white ring-4 ring-primary-600/20"
                      : "border border-line bg-card text-muted"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`hidden truncate text-xs font-medium min-[420px]:block ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 ? (
                <span className={`h-px flex-1 ${i < current ? "bg-primary-600" : "bg-line"}`} />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <div
          className="h-full rounded-full bg-primary-600 transition-all duration-300"
          style={{ width: `${((current + 1) / STEP_LABELS.length) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-medium text-muted" role="status">
        {current < 3
          ? `Step ${current + 1} of 3 — ${STEP_HEADINGS[current]}`
          : "Final step — Verify your email"}
      </p>
    </div>
  );
}

export default function SignupPage() {
  const [stage, setStage] = useState<"form" | "otp">("form");
  const [formStep, setFormStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
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

  // Turnstile lives on the final form step only: render the widget when
  // step 3 mounts, drop the token when it unmounts (going Back rebuilds
  // a fresh widget + token on return; a token is also single-use and
  // expires after ~5 minutes, so never carry one across steps).
  useEffect(() => {
    if (stage !== "form" || formStep !== 2 || !turnstileRef.current) return;
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
      tokenRef.current = "";
      widgetIdRef.current = null;
    };
  }, [stage, formStep]);

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

  function gotoStep(next: number) {
    setDirection(next > formStep ? "forward" : "back");
    setFormStep(next);
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
      autoFocus?: boolean;
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
          autoFocus={opts.autoFocus}
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
    autoFocus = false,
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
            autoFocus={autoFocus}
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

  /** Client-side checks for ONE step — mirrors the server rules. */
  function validateStep(s: number): Record<string, string> {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!name.trim()) errs.full_name = FRIENDLY_FIELD_ERRORS.required;
      if (!EMAIL_RE.test(email.trim())) {
        errs.email = FRIENDLY_FIELD_ERRORS["invalid-email"];
      }
    } else if (s === 1) {
      if (!password) {
        errs.password = FRIENDLY_FIELD_ERRORS.required;
      } else if (!PASSWORD_RULES.every((r) => r.test(password))) {
        errs.password = FRIENDLY_FIELD_ERRORS["weak-password"];
      }
      if (password && password !== confirm) {
        errs.confirm = "Passwords do not match.";
      }
    } else if (s === 2) {
      if (!isValidIndianMobile(phone)) {
        errs.phone_no = FRIENDLY_FIELD_ERRORS["invalid-phone"];
      }
      if (!isValidWhatsApp(sameAsPhone ? phone : whatsapp)) {
        errs.whatsapp_no = FRIENDLY_FIELD_ERRORS["invalid-whatsapp"];
      }
      const alt = altEmail.trim();
      if (alt) {
        if (!EMAIL_RE.test(alt)) {
          errs.alternative_email = FRIENDLY_FIELD_ERRORS["invalid-alt-email"];
        } else if (alt.toLowerCase() === email.trim().toLowerCase()) {
          errs.alternative_email = FRIENDLY_FIELD_ERRORS["alt-email-same-as-primary"];
        }
      }
    }
    return errs;
  }

  /** Validate the current step; on success advance, on failure stay put. */
  function advance(): boolean {
    const errs = validateStep(formStep);
    setErrors((prev) => {
      const next = { ...prev };
      for (const f of STEP_FIELDS[formStep]) delete next[f];
      return { ...next, ...errs };
    });
    if (Object.keys(errs).length > 0) return false;
    gotoStep(formStep + 1);
    return true;
  }

  async function doSignup() {
    // Final step's own checks first; then a safety pass over earlier
    // steps (values are preserved across navigation, but never trust
    // that the user visited them in order).
    const last = validateStep(2);
    if (Object.keys(last).length > 0) {
      setErrors((prev) => ({ ...prev, ...last }));
      return;
    }
    for (let s = 0; s < 2; s++) {
      const errs = validateStep(s);
      if (Object.keys(errs).length > 0) {
        setErrors((prev) => ({ ...prev, ...errs }));
        gotoStep(s);
        return;
      }
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
      setStage("otp");
    } catch (err) {
      if (widgetIdRef.current !== null) resetTurnstile(widgetIdRef.current);
      tokenRef.current = "";
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === "exists") {
          setExistsError(true);
          gotoStep(FIELD_STEP.email);
        } else if (err.code === "email-failed") {
          // The account row exists; only the mail failed. Resend works.
          setOtpNotice(
            "Your account was created, but the verification email could not be sent. Use “Resend code” below.",
          );
          setStage("otp");
        } else if (err.fields && Object.keys(err.fields).length > 0) {
          const mapped: Record<string, string> = {};
          for (const [key, code] of Object.entries(err.fields)) {
            mapped[key] = friendlyFieldError(code);
          }
          setErrors(mapped);
          // Send the user to the earliest step that owns a bad field.
          const target = Math.min(
            ...Object.keys(mapped)
              .map((k) => FIELD_STEP[k])
              .filter((n) => n !== undefined),
          );
          if (Number.isFinite(target) && target !== formStep) gotoStep(target);
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

  // One form for the whole wizard: Enter on steps 1–2 means "Continue",
  // Enter on step 3 (or the submit button there) creates the account.
  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setBanner("");
    setExistsError(false);
    if (formStep < 2) {
      advance();
    } else {
      void doSignup();
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

  if (stage === "otp") {
    return (
      <AuthLayout>
        <div className="kb-step-enter-right">
          <h1 className="text-center font-display text-2xl font-semibold text-ink">
            Verify your email
          </h1>
          <p className="mt-1 text-center text-sm text-muted">
            One last step — confirm the code we emailed you.
          </p>

          <Progress current={3} />

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
                autoFocus
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
        </div>
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
        Three short steps — we only ask for the essentials.
      </p>

      <Progress current={formStep} />

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

      <form onSubmit={handleFormSubmit} className="mt-6" noValidate>
        <div
          key={formStep}
          className={direction === "forward" ? "kb-step-enter-right" : "kb-step-enter-left"}
        >
          <h2 className="text-base font-semibold text-ink">{STEP_HEADINGS[formStep]}</h2>

          {formStep === 0 ? (
            <div className="mt-4 space-y-4">
              {textField("full_name", "Your name", name, setName, {
                autoComplete: "name",
                placeholder: "Ramesh Sharma",
                autoFocus: true,
              })}
              {textField("email", "Email", email, setEmail, {
                type: "email",
                autoComplete: "email",
                inputMode: "email",
                placeholder: "you@example.com",
                hint: "We email your verification code and order updates here.",
              })}
              <button type="submit" className={buttonPrimaryClass}>
                Continue
              </button>
              <p className="text-center text-xs text-muted">
                No payment or billing details are needed to sign up.
              </p>
            </div>
          ) : null}

          {formStep === 1 ? (
            <div className="mt-4 space-y-4">
              <Field label="Password" error={fieldError("password")}>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    autoFocus
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
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={`flex items-center gap-2 text-xs ${
                          ok ? "font-medium text-success" : "text-muted"
                        }`}
                      >
                        <span aria-hidden>{ok ? "✓" : "○"}</span>
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
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
              <div className="flex gap-3">
                <div className="flex-1">
                  <button type="button" className={buttonGhostClass} onClick={() => gotoStep(0)}>
                    Back
                  </button>
                </div>
                <div className="flex-[2]">
                  <button type="submit" className={buttonPrimaryClass}>
                    Continue
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {formStep === 2 ? (
            <div className="mt-4 space-y-4">
              {phoneField(
                "phone_no",
                "Mobile number",
                phone,
                setPhone,
                "Your 10-digit Indian mobile — for order updates and support calls.",
                true,
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

              <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Review your details
                </p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="shrink-0 text-muted">Name</dt>
                    <dd className="truncate font-medium text-ink">{name.trim()}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="shrink-0 text-muted">Email</dt>
                    <dd className="truncate font-medium text-ink">{email.trim()}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="shrink-0 text-muted">Mobile</dt>
                    <dd className="truncate font-medium text-ink">+91 {phone.trim()}</dd>
                  </div>
                  {!sameAsPhone && whatsapp.trim() ? (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 text-muted">WhatsApp</dt>
                      <dd className="truncate font-medium text-ink">+91 {whatsapp.trim()}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-2 text-xs text-muted">
                  Anything wrong? Use Back to fix it before you continue.
                </p>
              </div>

              <div ref={turnstileRef} className="flex justify-center" />
              <div className="flex gap-3">
                <div className="flex-1">
                  <button
                    type="button"
                    className={buttonGhostClass}
                    onClick={() => gotoStep(1)}
                    disabled={busy}
                  >
                    Back
                  </button>
                </div>
                <div className="flex-[2]">
                  <button type="submit" className={buttonPrimaryClass} disabled={busy}>
                    {busy ? "Creating account…" : "Create account"}
                  </button>
                </div>
              </div>
              <p className="text-center text-xs text-muted">
                We&apos;ll email you a 6-digit code to verify your address.
              </p>
            </div>
          ) : null}
        </div>
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
