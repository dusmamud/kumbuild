// Shared data for the Kumbuild blog — navigation, topics, FAQs.
// Topics and counts are computed from the posts collection itself,
// so nothing here can drift from the real content.

export interface Topic {
  slug: string;
  label: string;
}

export const topicSlug = (tag: string) =>
  tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const NAV_LINKS = [
  { label: "Latest", href: "/#latest" },
  { label: "Topics", href: "/#topics" },
  { label: "FAQ", href: "/#faq" },
  { label: "Help docs", href: "https://docs.kumbuild.com" },
  { label: "Main site", href: "https://kumbuild.com" },
];

export const BLOG_FAQS = [
  {
    q: "Who writes the Kumbuild blog?",
    a: "The Kumbuild team — the same people who build the websites. Every article comes from real questions business owners ask us on WhatsApp, answered in plain words.",
  },
  {
    q: "Is this blog trying to sell me something?",
    a: "The articles are free and useful whether you buy or not. If they convince you that a proper website matters, Kumbuild is one way to get one — that is the honest connection, and it is the only one.",
  },
  {
    q: "Can I ask for a topic?",
    a: "Yes — message us on WhatsApp with the question you want answered. Owner questions are exactly what we write about.",
  },
  {
    q: "How often do new articles appear?",
    a: "When a question comes up often enough to deserve a full answer. No daily filler, no AI-generated lists — every post earns its place.",
  },
];

// Articles are written by the Kumbuild team (stated in BLOG_FAQS above
// and in the footer) — bylines and structured data use the same words.
export const BLOG_AUTHOR = "Kumbuild team";

export const WA_NUMBER = "919876543210";
export const waLink = (text: string) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
