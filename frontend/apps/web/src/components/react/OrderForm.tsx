import { useMemo, useState, type FormEvent } from "react";
import type { Dictionary } from "@kumbuild/lib";

interface Props {
  dict: Dictionary;
  locale: string;
}

const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100";
const labelCls = "mb-1 block text-sm font-bold text-ink";

/**
 * Order form — React island (client:load).
 * No backend yet: on submit it validates locally and shows a mock
 * confirmation with a reference. Nothing is sent anywhere.
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
  const [errors, setErrors] = useState<string[]>([]);
  const [reference, setReference] = useState<string | null>(null);

  const referenceFor = useMemo(() => reference, [reference]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!name.trim()) missing.push(o.name);
    if (!phone.trim()) missing.push(o.phone);
    if (!businessName.trim()) missing.push(o.businessName);
    if (!message.trim()) missing.push(o.message);
    setErrors(missing);
    if (missing.length > 0) return;
    const ref = `KB-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setReference(ref);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (referenceFor) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <h2 className="text-xl font-bold text-ink">{o.successTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-body">{o.successText}</p>
        <p className="mt-4 text-sm">
          <span className="font-bold text-ink">{o.reference}: </span>
          <code className="rounded bg-white px-2 py-1 font-mono font-bold text-primary-700">{referenceFor}</code>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-line bg-white p-6" noValidate>
      {errors.length > 0 && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {o.required}: {errors.join(", ")}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="of-name">{o.name} *</label>
          <input id="of-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="of-phone">{o.phone} *</label>
          <input id="of-phone" className={inputCls} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="of-wa">{o.whatsapp}</label>
          <input id="of-wa" className={inputCls} type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={phone} />
        </div>
        <div>
          <label className={labelCls} htmlFor="of-biz">{o.businessName} *</label>
          <input id="of-biz" className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
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
          <textarea id="of-msg" className={inputCls} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
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
      <button type="submit" className="mt-6 rounded-lg bg-primary-500 px-6 py-3 font-bold text-white hover:bg-primary-600">
        {o.submit}
      </button>
      <p className="mt-3 text-xs text-muted">{o.note}</p>
    </form>
  );
}
