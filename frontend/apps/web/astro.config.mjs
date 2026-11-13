import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Kumbuild public site — kumbuild.com
// Astro + React islands. Light theme ONLY (THEME.md). i18n: en-US default
// (no URL prefix), hi -> /hi/, bn -> /bn/, as -> /as/.
export default defineConfig({
  site: "https://kumbuild.com",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    locales: [
      { path: "hi", codes: ["hi"] },
      { path: "bn", codes: ["bn"] },
      { path: "as", codes: ["as"] },
      { path: "en-US", codes: ["en-US", "en"] },
    ],
    defaultLocale: "en-US",
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
