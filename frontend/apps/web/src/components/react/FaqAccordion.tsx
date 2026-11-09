import { useState } from "react";

interface Item {
  q: string;
  a: string;
}

/** FAQ accordion — React island (client:load) for the /faq page. */
export default function FaqAccordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-line bg-white">
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold text-ink"
            aria-expanded={open === i}
          >
            <span>{item.q}</span>
            <span className="text-primary-600">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && (
            <p className="px-5 pb-4 text-sm leading-relaxed text-body">{item.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}
