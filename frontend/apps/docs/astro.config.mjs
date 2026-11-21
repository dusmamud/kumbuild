// Kumbuild docs — live at https://kumbuild-docs.pages.dev for now.
// docs.kumbuild.com is NOT bought yet; when Dus buys/adds the custom
// domain, point `site` (and the og:image URLs below) back to
// https://docs.kumbuild.com — Starlight builds canonicals, sitemap and
// og:url from `site`, so a wrong host poisons all three (audit F2).
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://kumbuild-docs.pages.dev",
  integrations: [
    starlight({
      title: "Kumbuild Docs",
      description:
        "Help and guides for Kumbuild customers — ordering, previews, payments, renewals and getting found on Google.",
      // og:image (audit F4): the existing Kumbuild logo. It is an SVG —
      // most link-preview scrapers prefer a raster image, so a PNG
      // export is an open follow-up; an SVG URL still beats no image.
      head: [
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://kumbuild-docs.pages.dev/logo/kumbuild-logo.svg",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "https://kumbuild-docs.pages.dev/logo/kumbuild-logo.svg",
          },
        },
      ],
      logo: { src: "./src/assets/kumbuild-logo.svg", alt: "Kumbuild" },
      favicon: "/logo/kumbuild-logo.svg",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/dusmamud/kumbuild" },
      ],
      customCss: ["./src/styles/starlight.css"],
      components: {
        Head: "./src/components/Head.astro",
        Header: "./src/components/Header.astro",
        Footer: "./src/components/Footer.astro",
      },
      editLink: {
        baseUrl: "https://github.com/dusmamud/kumbuild/edit/main/frontend/apps/docs/",
      },
      lastUpdated: true,
      sidebar: [
        {
          label: "Start here",
          items: [
            { slug: "index" },
            { slug: "getting-started/quickstart" },
            { slug: "getting-started/how-kumbuild-works" },
            { slug: "getting-started/what-you-get" },
            { slug: "getting-started/before-you-order" },
            { slug: "getting-started/order-your-website" },
          ],
        },
        {
          label: "Your website",
          items: [
            { slug: "your-website/preview-and-revisions" },
            { slug: "your-website/content-guide" },
            { slug: "your-website/launch-checklist" },
            { slug: "your-website/managing-your-site" },
            { slug: "your-website/changes-after-launch" },
            { slug: "your-website/payments-and-renewal" },
          ],
        },
        {
          label: "Grow",
          items: [
            { slug: "grow/get-found-on-google" },
            { slug: "grow/your-first-customers-online" },
          ],
        },
        {
          label: "Help",
          items: [
            { slug: "help/troubleshooting" },
            { slug: "help/faq" },
            { slug: "help/glossary" },
            { slug: "help/changelog" },
            { slug: "help/contact" },
          ],
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
