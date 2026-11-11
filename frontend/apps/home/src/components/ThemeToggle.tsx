import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Light/dark toggle — same behaviour as the blog and docs:
// the no-flash script in index.html sets <html data-theme> before
// first paint (localStorage "kb-theme", else the system setting);
// this button flips it and saves the choice under the same key.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("kb-theme", next);
    } catch {
      // Storage unavailable (private mode) — the toggle still applies
      // for this visit.
    }
    setDark(next === "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card text-body transition-colors hover:text-ink lg:h-9 lg:w-9"
      aria-label="Switch theme"
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
