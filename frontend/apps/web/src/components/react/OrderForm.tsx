import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import type { Dictionary } from "@kumbuild/lib";

interface Props {
  dict: Dictionary;
  locale: string;
}

type FieldKey = "name" | "phone" | "businessName" | "message";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100";
const inputErrCls = "border-danger focus:border-danger focus:ring-danger/20";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

function validPhone(v: string): boolean {
  const digits = v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return digits.length >= 10;
}

/**
 * Order form — React island (client:load).
 * No backend yet: on submit it validates locally (per-field errors,
 * phone format) and shows a mock confirmation with a reference.
 * Nothing is sent anywhere.
 */
export default function OrderForm({ dict, locale }: Props) {
  const o = dict.order;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState(o.businessTypeOptions[0]);
  const [pkg, setPkg] = useState(dict.pricing.packages[1].slug);
  const [message, setMessage] = useState("");
  const [contentLanguage, setContentLanguage] = useState(locale);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [reference, setReference] = useState<string | null>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reference) successRef.current?.focus();
  }, [reference]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!name.trim()) errs.name = o.required;
    if (!phone.trim()) errs.phone = o.required;
    else if (!validPhone(phone)) errs.phone = o.invalidPhone;
    if (!businessName.trim()) errs.businessName = o.required;
    if (!message.trim()) errs.message = o.required;
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const ref = `KB-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setReference(ref);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const fieldErr = (key: FieldKey) =>
    errors[key] ? (
      <p id={`of-${key}-err`} className="mt-1.5 text-sm font-medium text-danger">
        {errors[key]}
      </p>
    ) : null;
  const ariaFor = (key: FieldKey) =>
    errors[key]
      ? { "aria-invalid": true as const, "aria-describedby": `of-${key}-err` }
      : {};

  if (reference) {
    return (
      <motion.div
        ref={successRef}
        tabIndex={-1}
        role="status"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-green-200 bg-green-50 p-6 outline-none sm:p-8"
      >
        <div className="flex items-center gap-2">
          <svg className="h-6 w-6 shrink-0 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
          <h2 className="font-display text-xl font-semibold text-ink">{o.successTitle}</h2>
        </div>
        <p className="mt-2 text-base leading-[28px] text-body">{o.successText}</p>
        <p className="mt-4 text-sm">
          <span className="font-semibold text-ink">{o.reference}: </span>
          <code className="rounded bg-white px-2 py-1 font-mono font-bold text-primary-700">{reference}</code>
        </p>
      </motion.div>
    );
  }

  const errList = (Object.keys(errors) as FieldKey[]).map(
    (k) => ({ name: o.name, phone: o.phone, businessName: o.businessName, message: o.message })[k],
  );

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-white p-6 sm:p-8" noValidate>
      {errList.length > 0 && (
        <p
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 outline-none"
        >
          {o.required}: {errList.join(", ")}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="of-name">{o.name} *</label>
          <input id="of-name" className={`${inputCls} ${errors.name ? inputErrCls : ""}`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" {...ariaFor("name")} />
          {fieldErr("name")}
        </div>
        <div>
          <label className={labelCls} htmlFor="of-phone">{o.phone} *</label>
          <input id="of-phone" className={`${inputCls} ${errors.phone ? inputErrCls : ""}`} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" {...ariaFor("phone")} />
          {fieldErr("phone")}
        </div>
        <div>
          <label className={labelCls} htmlFor="of-wa">{o.whatsapp}</label>
          <input id="of-wa" className={inputCls} type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} autoComplete="tel" aria-describedby="of-wa-hint" />
          <p id="of-wa-hint" className="mt-1.5 text-sm text-muted">{o.waHint}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="of-biz">{o.businessName} *</label>
          <input id="of-biz" className={`${inputCls} ${errors.businessName ? inputErrCls : ""}`} value={businessName} onChange={(e) => setBusinessName(e.target.value)} autoComplete="organization" {...ariaFor("businessName")} />
          {fieldErr("businessName")}
        </div>
        <div>
          <label className={labelCls} htmlFor="of-type">{o.businessType}</label>
          <select id="of-type" className={inputCls} value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            {o.businessTypeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="of-pkg">{o.package}</label>
          <select id="of-pkg" className={inputCls} value={pkg} onChange={(e) => setPkg(e.target.value)}>
            {dict.pricing.packages.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name} — {p.price}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="of-msg">{o.message} *</label>
          <textarea id="of-msg" className={`${inputCls} ${errors.message ? inputErrCls : ""}`} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} {...ariaFor("message")} />
          {fieldErr("message")}
        </div>
        <div>
          <label className={labelCls} htmlFor="of-lang">{o.contentLanguage}</label>
          <select id="of-lang" className={inputCls} value={contentLanguage} onChange={(e) => setContentLanguage(e.target.value)}>
            <option value="en-US">English</option>
            <option value="hi">हिन्दी</option>
            <option value="bn">বাংলা</option>
          </select>
        </div>
      </div>
      <button type="submit" className="mt-7 w-full rounded-xl bg-primary-600 px-6 py-3.5 text-base font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-primary-700 active:scale-[0.98] sm:w-auto">
        {o.submit}
      </button>
      <p className="mt-3 text-sm text-muted">* {o.required} · {o.note}</p>
    </form>
  );
}
