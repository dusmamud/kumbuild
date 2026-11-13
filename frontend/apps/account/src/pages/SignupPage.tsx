import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  api,
  ApiError,
  cacheUser,
  fetchSession,
  renderTurnstile,
  resetTurnstile,
  type SignupInput,
} from "@kumbuild/lib";
import { WEB_URL, redirectForRole } from "../lib/urls";
import AuthLayout from "../components/AuthLayout";
import {
  ErrorBanner,
  FadeIn,
  Field,
  PasswordInput,
  PhoneInput,
  StepSlide,
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
// per-step zod schemas below only mirror the server rules for fast
// feedback — the server stays authoritative, and its field errors route
// the user back to the step that owns the field.
//
// OTP facts verified from the Go backend (NOT from the research report):
// expiry is 10 minutes (backend/internal/store/token_store.go: OTPTTL =
// 10 * time.Minute); resend is rate-limited to 5/min per IP AND 5/min
// per email (backend/internal/handlers/auth.go: ResendOTP). The backend
// has NO per-code cooldown, so the 30s UI cooldown below is ours; an
// expired code comes back as the generic "invalid-code" — the backend
// never says "that code expired" specifically.

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

// One schema for the whole wizard, validated per step: the rules and
// messages are EXACTLY the old validateStep / PASSWORD_RULES /
// isValidIndianMobile / isValidWhatsApp checks, including the quirks —
// name is only required (min-2 comes from the server as invalid-name),
// email has no separate "required" message, confirm is only checked
// when a password is set.
const signupSchema = z
  .object({
    full_name: z
      .string()
      .refine((v) => v.trim().length > 0, FRIENDLY_FIELD_ERRORS.required),
    email: z
      .string()
      .refine((v) => EMAIL_RE.test(v.trim()), FRIENDLY_FIELD_ERRORS["invalid-email"]),
    password: z
      .string()
      .min(1, FRIENDLY_FIELD_ERRORS.required)
      .refine(
        (v) => PASSWORD_RULES.every((r) => r.test(v)),
        FRIENDLY_FIELD_ERRORS["weak-password"],
      ),
    confirm: z.string(),
    phone_no: z
      .string()
      .refine((v) => isValidIndianMobile(v), FRIENDLY_FIELD_ERRORS["invalid-phone"]),
    whatsapp_no: z.string(),
    sameAsPhone: z.boolean(),
    alternative_email: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.password && v.password !== v.confirm) {
      ctx.addIssue({
        code: "custom",
        path: ["confirm"],
        message: "Passwords do not match.",
      });
    }
    if (!isValidWhatsApp(v.sameAsPhone ? v.phone_no : v.whatsapp_no)) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp_no"],
        message: FRIENDLY_FIELD_ERRORS["invalid-whatsapp"],
      });
    }
    const alt = v.alternative_email.trim();
    if (alt) {
      if (!EMAIL_RE.test(alt)) {
        ctx.addIssue({
          code: "custom",
          path: ["alternative_email"],
          message: FRIENDLY_FIELD_ERRORS["invalid-alt-email"],
        });
      } else if (alt.toLowerCase() === v.email.trim().toLowerCase()) {
        ctx.addIssue({
          code: "custom",
          path: ["alternative_email"],
          message: FRIENDLY_FIELD_ERRORS["alt-email-same-as-primary"],
        });
      }
    }
  });

type SignupValues = z.infer<typeof signupSchema>;

// Which form step owns each payload field — used both for per-step
// validation and for routing server field errors back to their step.
const STEP_FIELDS: Record<number, (keyof SignupValues)[]> = {
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

/** Resend cooldown: 30s after entering the OTP stage / each resend. */
const RESEND_COOLDOWN_S = 30;

const buttonGhostClass =
  "inline-flex w-full items-center justify-center rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-50";

/**
 * Turnstile widget, rendered only on the final signup step. A child
 * component on purpose: its own useEffect runs after the DOM exists,
 * so it is immune to the StepSlide / AnimatePresence mount delay that
 * killed the old parent effect (that effect fired while the step-3
 * container was still unmounted and never re-ran). Mount renders a
 * fresh widget; unmount (going Back, leaving for the OTP stage) drops
 * the token — a token is single-use and ~5 min, so it is never carried
 * across steps. widgetId stays in the parent's ref so doSignup can
 * reset the widget after a failed attempt, as before.
 */
function TurnstileSlot({
  tokenRef,
  widgetIdRef,
}: {
  tokenRef: { current: string };
  widgetIdRef: { current: number | null };
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const el = slotRef.current;
    if (!el) return;
    renderTurnstile(el, (token) => {
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
  }, [tokenRef, widgetIdRef]);
  return <div ref={slotRef} className="flex justify-center" />;
}

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
                {done ? (
                  "✓"
                ) : active ? (
                  <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
                ) : null}
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
        {current < 3 ? STEP_HEADINGS[current] : "Final step — Verify your email"}
      </p>
    </div>
  );
}

export default function SignupPage() {
  const [stage, setStage] = useState<"form" | "otp">("form");
  const [formStep, setFormStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner] = useState("");
  const [existsError, setExistsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const widgetIdRef = useRef<number | null>(null);
  const tokenRef = useRef("");

  const {
    register,
    handleSubmit,
    trigger,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    // Steps unmount as the user moves on — keep their values + errors.
    shouldUnregister: false,
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirm: "",
      phone_no: "",
      whatsapp_no: "",
      sameAsPhone: false,
      alternative_email: "",
    },
  });

  // Live values for the step-2 checklist and the step-3 review summary.
  const passwordValue = watch("password");
  const sameAsPhone = watch("sameAsPhone");
  const reviewName = watch("full_name");
  const reviewEmail = watch("email");
  const reviewPhone = watch("phone_no");
  const reviewWhatsapp = watch("whatsapp_no");

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

  // Start the resend cooldown when the OTP stage opens.
  useEffect(() => {
    if (stage === "otp") setResendIn(RESEND_COOLDOWN_S);
  }, [stage]);

  // Tick the resend countdown down once a second.
  useEffect(() => {
    if (stage !== "otp" || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, resendIn]);

  function gotoStep(next: number) {
    setDirection(next > formStep ? "forward" : "back");
    setFormStep(next);
  }

  /** Validate the current step; on success advance, on failure stay put. */
  async function advance() {
    const ok = await trigger(STEP_FIELDS[formStep], { shouldFocus: true });
    if (ok) gotoStep(formStep + 1);
  }

  async function doSignup(values: SignupValues) {
    if (!tokenRef.current) {
      setBanner("Please complete the verification check, then try again.");
      return;
    }
    const input: SignupInput = {
      full_name: values.full_name.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
      phone_no: values.phone_no.trim(),
      whatsapp_no: (values.sameAsPhone ? values.phone_no : values.whatsapp_no).trim(),
      turnstile_token: tokenRef.current,
    };
    if (values.alternative_email.trim())
      input.alternative_email = values.alternative_email.trim().toLowerCase();

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
          clearErrors();
          const fieldNames = Object.keys(err.fields);
          for (const [key, code] of Object.entries(err.fields)) {
            setError(key as keyof SignupValues, {
              type: "server",
              message: friendlyFieldError(code),
            });
          }
          // Send the user to the earliest step that owns a bad field.
          const target = Math.min(
            ...fieldNames
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
      void advance();
    } else {
      // Full validation (all steps) before signup; values are already
      // typed as SignupValues by the resolver.
      void handleSubmit(doSignup)();
    }
  }

  /** Pasted/typed codes: strip spaces and dashes ("123 456" -> "123456"). */
  function normaliseCode(raw: string): string {
    return raw.replace(/[\s-]/g, "");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setCodeError("");
    setBanner("");
    const value = normaliseCode(code);
    setBusy(true);
    try {
      const { user } = await api.verifyEmail(
        reviewEmail.trim().toLowerCase(),
        value,
      );
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
      const { message } = await api.resendOtp(reviewEmail.trim().toLowerCase());
      const notice =
        message === ""
          ? "A new code is on its way if your account is pending verification."
          : message;
      toast.success(notice);
      setResendIn(RESEND_COOLDOWN_S);
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : "Could not resend the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "otp") {
    return (
      <AuthLayout>
        <FadeIn>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Verify your email
          </h1>
          <p className="mt-1 text-sm text-muted">
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
            <Field
              id="otp-code"
              label="6-digit code"
              error={codeError}
              hint="The code expires in 10 minutes."
            >
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(normaliseCode(e.target.value));
                  setCodeError("");
                }}
                className={`${inputClass} ${codeError ? inputErrorClass : ""}`}
              />
            </Field>
            <button type="submit" className={buttonPrimaryClass} disabled={busy}>
              {busy ? "Verifying…" : "Verify and continue"}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted">
            Didn&apos;t get the code?{" "}
            <button
              type="button"
              onClick={resend}
              disabled={busy || resendIn > 0}
              className="font-medium text-primary-700 hover:underline disabled:opacity-50"
            >
              {resendIn > 0
                ? `Resend in 0:${String(resendIn).padStart(2, "0")}`
                : "Resend code"}
            </button>
          </p>
        </FadeIn>
      </AuthLayout>
    );
  }

  const stepErrorCount = STEP_FIELDS[formStep].filter((f) => errors[f]).length;

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold text-ink">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-muted">
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
      {stepErrorCount > 0 ? (
        <div className="mt-6">
          <ErrorBanner>
            {stepErrorCount === 1
              ? "Please fix the highlighted field below."
              : `Please fix the ${stepErrorCount} highlighted fields below.`}
          </ErrorBanner>
        </div>
      ) : null}

      <form onSubmit={handleFormSubmit} className="mt-6" noValidate>
        <FadeIn>
          <StepSlide stepKey={formStep} direction={direction}>
            <h2 className="text-base font-semibold text-ink">{STEP_HEADINGS[formStep]}</h2>

            {formStep === 0 ? (
              <div className="mt-4 space-y-4">
                <Field id="signup-name" label="Your name" error={errors.full_name?.message}>
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Ramesh Sharma"
                    autoFocus
                    {...register("full_name")}
                    className={`${inputClass} ${errors.full_name ? inputErrorClass : ""}`}
                  />
                </Field>
                <Field
                  id="signup-email"
                  label="Email"
                  error={errors.email?.message}
                  hint="We email your verification code and order updates here."
                >
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    {...register("email")}
                    className={`${inputClass} ${errors.email ? inputErrorClass : ""}`}
                  />
                </Field>
                <button type="submit" className={buttonPrimaryClass}>
                  Continue
                </button>
                <p className="text-xs text-muted">
                  No payment or billing details are needed to sign up.
                </p>
              </div>
            ) : null}

            {formStep === 1 ? (
              <div className="mt-4 space-y-4">
                <Field id="signup-password" label="Password" error={errors.password?.message}>
                  <PasswordInput
                    show={showPassword}
                    onToggleShow={() => setShowPassword((v) => !v)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    autoFocus
                    {...register("password")}
                    className={errors.password ? inputErrorClass : ""}
                  />
                </Field>
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(passwordValue ?? "");
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
                <Field
                  id="signup-confirm"
                  label="Confirm password"
                  error={errors.confirm?.message}
                >
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...register("confirm")}
                    className={`${inputClass} ${errors.confirm ? inputErrorClass : ""}`}
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
                <Field
                  id="signup-phone"
                  label="Mobile number"
                  error={errors.phone_no?.message}
                  hint="Your 10-digit Indian mobile — for order updates and support calls."
                >
                  <PhoneInput
                    autoComplete="tel-national"
                    inputMode="tel"
                    placeholder="98765 43210"
                    autoFocus
                    {...register("phone_no")}
                    className={errors.phone_no ? inputErrorClass : ""}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-body">
                  <input
                    type="checkbox"
                    {...register("sameAsPhone", {
                      onChange: () => clearErrors("whatsapp_no"),
                    })}
                    className="h-4 w-4 rounded border-line"
                  />
                  WhatsApp number is the same as my mobile number
                </label>
                {!sameAsPhone ? (
                  <Field
                    id="signup-whatsapp"
                    label="WhatsApp number"
                    error={errors.whatsapp_no?.message}
                    hint="We share design previews and progress on WhatsApp."
                  >
                    <PhoneInput
                      autoComplete="tel-national"
                      inputMode="tel"
                      placeholder="98765 43210"
                      {...register("whatsapp_no")}
                      className={errors.whatsapp_no ? inputErrorClass : ""}
                    />
                  </Field>
                ) : null}
                <Field
                  id="signup-alt-email"
                  label="Alternative email (optional)"
                  error={errors.alternative_email?.message}
                  hint="A backup email, in case you lose access to your main one."
                >
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="other@example.com"
                    {...register("alternative_email")}
                    className={`${inputClass} ${errors.alternative_email ? inputErrorClass : ""}`}
                  />
                </Field>

                <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Review your details
                  </p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 text-muted">Name</dt>
                      <dd className="truncate font-medium text-ink">{reviewName.trim()}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 text-muted">Email</dt>
                      <dd className="truncate font-medium text-ink">{reviewEmail.trim()}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 text-muted">Mobile</dt>
                      <dd className="truncate font-medium text-ink">+91 {reviewPhone.trim()}</dd>
                    </div>
                    {!sameAsPhone && reviewWhatsapp.trim() ? (
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="shrink-0 text-muted">WhatsApp</dt>
                        <dd className="truncate font-medium text-ink">+91 {reviewWhatsapp.trim()}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="mt-2 text-xs text-muted">
                    Anything wrong? Use Back to fix it before you continue.
                  </p>
                </div>

                <TurnstileSlot tokenRef={tokenRef} widgetIdRef={widgetIdRef} />
                <p className="text-xs text-muted">
                  By creating an account, you agree to our{" "}
                  <a
                    href={`${WEB_URL}/terms`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary-700 hover:underline"
                  >
                    Terms
                  </a>{" "}
                  and{" "}
                  <a
                    href={`${WEB_URL}/privacy`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary-700 hover:underline"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
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
                <p className="text-xs text-muted">
                  We&apos;ll email you a 6-digit code to verify your address.
                </p>
              </div>
            ) : null}
          </StepSlide>
        </FadeIn>
      </form>

      <div className="mt-6 border-t border-line pt-5 text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary-700 hover:underline">
          Log in
        </Link>
      </div>
    </AuthLayout>
  );
}
