// Kumbuild docs — docs.kumbuild.com
// Astro 7 + Starlight. Help and guides for Kumbuild customers.
// Light + dark theme both on (Starlight built-in toggle), graded to
// the main site's palette via src/styles/starlight.css.
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://docs.kumbuild.com",
  integrations: [
    starlight({
      title: "Kumbuild Docs",
      description:
        "Help and guides for Kumbuild customers — ordering, previews, payments, renewals and getting found on Google.",
      logo: { src: "./src/assets/kumbuild-logo.svg", alt: "Kumbuild" },
      favicon: "/logo/kumbuild-logo.svg",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/dusmamud/kumbuild" },
      ],
      customCss: ["./src/styles/starlight.css"],
      editLink: {
        baseUrl: "https://github.com/dusmamud/kumbuild/edit/main/frontend/apps/docs/",
      },
      lastUpdated: true,
      sidebar: [
        {
          label: "Start here",
          items: [
            { slug: "index" },
            { slug: "getting-started/how-kumbuild-works" },
            { slug: "getting-started/order-your-website" },
          ],
        },
        {
          label: "Your website",
          items: [
            { slug: "your-website/preview-and-revisions" },
            { slug: "your-website/payments-and-renewal" },
            { slug: "your-website/changes-after-launch" },
          ],
        },
        {
          label: "Grow",
          items: [{ slug: "grow/get-found-on-google" }],
        },
        {
          label: "Help",
          items: [{ slug: "help/faq" }, { slug: "help/contact" }],
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
