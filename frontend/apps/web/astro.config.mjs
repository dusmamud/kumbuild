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
      // Exclude: locale 404 pages (real directory routes, but error pages
      // don't belong in a sitemap) and ALL demo/preview/work copies — they
      // are noindexed showcase duplicates (SEO audit 2026-11-22: they were
      // 399 of 511 sitemap URLs). Only real content pages stay.
      filter: (page) =>
        !page.endsWith("/404/") &&
        !page.includes("/preview/") &&
        !page.includes("/work/") &&
        !page.includes("/demo/"),
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
