import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Kumbuild public site — kumbuild.com
// Astro + React islands. Light theme ONLY (THEME.md). i18n: en-US default
// (no URL prefix), hi -> /hi/, bn -> /bn/, as -> /as/.
export default defineConfig({
  site: "https://kumbuild.com",
  integrations: [
    react(),
    sitemap({
      // Locale 404 pages are real directory routes (/hi/404/ etc.) so the
      // integration includes them by default; error pages don't belong in
      // a sitemap. (The root 404 is excluded automatically.)
      filter: (page) => !page.endsWith("/404/"),
    }),
  ],
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
