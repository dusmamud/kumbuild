"use client";

import { useEffect, useState } from "react";

// Theme toggle — THEME.md Section 5: System / Light / Dark.
// Choice cookie kb_theme me save hoti hai (1 saal), taaki server bhi jaane
// aur no-flash script paint se pehle sahi theme laga sake.
type Choice = "system" | "light" | "dark";

const CHOICES: { value: Choice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function applyTheme(choice: Choice) {
  const dark =
    choice === "dark" ||
    (choice !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )kb_theme=([^;]*)/);
    const saved = m ? decodeURIComponent(m[1]) : "system";
    setChoice(
      saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : "system",
    );
  }, []);

  function choose(next: Choice) {
    setChoice(next);
    document.cookie = `kb_theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    applyTheme(next);
  }

  return (
    <div
      className="inline-flex rounded-lg border border-line-strong p-0.5"
      role="group"
      aria-label="Theme"
    >
      {CHOICES.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => choose(c.value)}
          aria-pressed={choice === c.value}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
            choice === c.value
              ? "bg-primary-500 text-on-primary"
              : "text-muted hover:text-ink"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
