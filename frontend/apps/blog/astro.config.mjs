// Kumbuild blog — blog.kumbuild.com
// Astro 7 + React islands + Tailwind 4. Content: Markdown collections.
// Light + dark theme (Dus's decision 2026-11-11 for blog + docs).
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";
import rehypeExternalLinks from "rehype-external-links";

export default defineConfig({
  site: "https://blog.kumbuild.com",
  integrations: [react(), mdx(), sitemap(), icon()],
  markdown: {
    // Astro 7: plugins live on a Markdown processor. Unified keeps the
    // remark/rehype ecosystem (external-link handling) available.
    processor: unified({
      rehypePlugins: [
        [
          rehypeExternalLinks,
          { target: "_blank", rel: ["noopener", "noreferrer"] },
        ],
      ],
    }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
