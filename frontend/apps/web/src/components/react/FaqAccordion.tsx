import { useState } from "react";

interface Item {
  q: string;
  a: string;
}

interface Props {
  items: Item[];
  /** cards = boxed cards (/faq page) · rows = hairline list (homepage). */
  variant?: "cards" | "rows";
}

/** FAQ accordion — answers expand/collapse with a smooth height animation
    (CSS grid-rows 0fr -> 1fr on the site's one easing curve), chevron
    rotates, text fades in. Used on the /faq page and the homepage. */
export default function FaqAccordion({ items, variant = "cards" }: Props) {
  const [open, setOpen] = useState<number | null>(0);
  const rows = variant === "rows";
  return (
    <div className={rows ? "border-b border-line" : "space-y-3"}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `faq-panel-${variant}-${i}`;
        return (
          <div
            key={i}
            className={
              rows
                ? "border-t border-line"
                : `rounded-xl border bg-white transition-[border-color,box-shadow] duration-300 ${
                    isOpen
                      ? "border-primary-200 shadow-[0_14px_30px_-22px_rgba(28,25,23,0.35)]"
                      : "border-line"
                  }`
            }
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className={`flex w-full items-center justify-between gap-4 text-left font-semibold text-ink ${
                rows ? "py-5" : "px-5 py-4"
              }`}
              aria-expanded={isOpen}
              aria-controls={panelId}
            >
              <span>{item.q}</span>
              <svg
                className={`h-5 w-5 shrink-0 text-muted transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${
                  isOpen ? "rotate-180 text-primary-600" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div
              id={panelId}
              role="region"
              className="grid transition-[grid-template-rows] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="min-h-0 overflow-hidden">
                <p
                  className={`text-[15px] leading-[26px] text-body transition-opacity duration-300 motion-reduce:transition-none ${
                    rows ? "pb-5 pr-8" : "px-5 pb-5"
                  } ${isOpen ? "opacity-100 delay-75" : "opacity-0"}`}
                >
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
