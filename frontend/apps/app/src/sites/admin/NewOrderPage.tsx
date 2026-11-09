"use client";

import { useState } from "react";
import { PACKAGE_PRICE, type PackageName } from "@/lib/mock";
import { Card, PageTitle, Field, inputClass, buttonPrimaryClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";

// Admin — naya order add karo (SUBDOMAINS.md Section 3).
// Order WhatsApp DM / Instagram DM / website form se aata hai; confirm
// hone ke baad admin use yahan add karta hai. MOCK, CLIENT SIDE: backend
// nahi hai, isliye order abhi save nahi hota — form bharne par reference
// number milta hai (landing OrderForm jaisa pattern). Backend aane pe
// yahin se save hoga.
const PACKAGES: PackageName[] = ["Starter", "Business", "Premium"];
const BUSINESS_TYPES = ["Shop", "Clinic", "Tuition / Coaching", "Salon", "Restaurant / Cafe", "Other"];
const SOURCES = ["WhatsApp", "Instagram", "Website form"];

interface Success {
  ref: string;
  pkg: PackageName;
}

export default function NewOrderPage() {
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customerName = String(formData.get("customerName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const businessName = String(formData.get("businessName") ?? "").trim();
    const packageName = String(formData.get("packageName") ?? "") as PackageName;
    if (!customerName || !phone || !businessName || !PACKAGES.includes(packageName)) {
      setError(true);
      setSuccess(null);
      return;
    }
    setError(false);
    const ref = `KB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setSuccess({ ref, pkg: packageName });
  }

  const price = success ? PACKAGE_PRICE[success.pkg] : null;

  return (
    <div>
      <PageTitle
        title="Add order"
        subtitle="Confirm hua order yahan add karo — WhatsApp / Instagram DM / form se aaya ho. Status: Received se shuru hoga."
      />

      {error ? (
        <p className="mb-4 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error">
          Customer ka naam, phone, business ka naam aur package bharna lazmi hai.
        </p>
      ) : null}

      {success ? (
        <Card className="mb-6 border-success bg-success-bg">
          <p className="text-sm font-bold text-success">
            Order add ho gaya (mock) — reference: {success.ref}
          </p>
          <p className="mt-1 text-sm text-body">
            {success.pkg} package — ₹{price?.toLocaleString("en-IN")} (advance 50%: ₹{price ? Math.round(price / 2).toLocaleString("en-IN") : ""}).{" "}
            Ye mock hai — order abhi save nahi hua. Backend aane pe yahin se
            save hoga aur Orders list me dikhega.
          </p>
          <Link href="/orders" className="mt-3 inline-block font-semibold text-primary-text">
            ← All orders dekho
          </Link>
        </Card>
      ) : null}

      <Card>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer ka naam *">
            <input name="customerName" required placeholder="Ramesh Sharma" className={inputClass} />
          </Field>
          <Field label="WhatsApp / Phone *">
            <input name="phone" required type="tel" placeholder="+91 98765 43210" className={inputClass} />
          </Field>
          <Field label="Email (optional)">
            <input name="email" type="email" placeholder="customer@example.com" className={inputClass} />
          </Field>
          <Field label="Order kahan se aaya *">
            <select name="source" required defaultValue="WhatsApp" className={inputClass}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Business ka naam *">
            <input name="businessName" required placeholder="Sharma General Store" className={inputClass} />
          </Field>
          <Field label="Business type">
            <select name="businessType" defaultValue="Shop" className={inputClass}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Package *">
            <select name="packageName" required defaultValue="Business" className={inputClass}>
              {PACKAGES.map((p) => (
                <option key={p} value={p}>
                  {p} — ₹{PACKAGE_PRICE[p].toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Advance mila (₹, optional — khaali ho to 50% mana jayega)">
            <input name="advancePaid" type="number" min="0" placeholder="4000" className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes (services, pages, khaas baat)">
              <textarea name="notes" rows={3} placeholder="5 pages: Home, Products, About, Gallery, Contact." className={inputClass} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={buttonPrimaryClass}>
              Order add karo
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
