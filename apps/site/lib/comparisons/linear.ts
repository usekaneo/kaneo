import type { Comparison } from "./types";

export const linear: Comparison = {
  slug: "linear",
  competitor: "Linear",
  category: "saas",
  title: "Linear alternative: Kaneo vs Linear",
  description:
    "Kaneo is a fast, focused Linear alternative with boards, backlog, and workflows. Kaneo Cloud runs it for you from $4 a month, and you can self-host it too.",
  summary: "A fast, focused tracker that Kaneo Cloud runs for you.",
  heading: "The fast, focused Linear alternative",
  subheading:
    "Linear is fast and beautifully focused, but it's closed-source and cloud-only. Kaneo gives you a clean, focused workflow on Kaneo Cloud, and you can run it yourself whenever you want.",
  verdict:
    "Kaneo is a fast, uncluttered Linear alternative, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams. It keeps keyboard-friendly boards, backlog, and workflows, and it does not try to reproduce Linear's cycles, triage, or insights. Unlike Linear, it is MIT-licensed open source, so you can also run it on your own Docker host.",
  facts: {
    license: "MIT, versus a proprietary licence for Linear",
    hosting:
      "EU-hosted Kaneo Cloud, or self-host anywhere. Linear is cloud only",
    sso: "Free on every Kaneo build, paid plans on Linear",
    pricing: "Cloud from $4 / month, or $0 self-hosted",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: false },
    { feature: "Own your data", kaneo: true, them: false },
    { feature: "Fast, focused UI", kaneo: true, them: true },
    { feature: "Free to self-host", kaneo: true, them: false },
    { feature: "SSO included", kaneo: "Free", them: "Paid plans" },
    { feature: "Cloud pricing", kaneo: "From $4/mo", them: "Per user" },
  ],
  reasons: [
    {
      title: "Clean and focused",
      body: "Kaneo is built around the same idea Linear popularized: a fast, uncluttered way to plan and execute, without the SaaS lock-in.",
    },
    {
      title: "Open and self-hostable",
      body: "Run Kaneo on your own infrastructure under the MIT license, keep your data in-house, and never depend on a vendor staying online.",
    },
    {
      title: "Honest pricing",
      body: "Free forever to self-host with every feature, including SSO. Managed cloud from $4/month, with no seats-gated features.",
    },
  ],
  migration: {
    body: "Kaneo imports Linear teams from the app with a personal API key: workflow states, issues with their numbers, priorities, labels, assignees, comments, and relations. Linear is only read, never changed.",
    href: "https://kaneo.app/docs/core/migrations/from-linear",
    linkText: "Read the import guide",
  },
  honestNote:
    "Linear sets the bar for polish, speed, and deep product-team features like cycles and triage. If you're committed to cloud SaaS and want that specific, highly-refined workflow, it's excellent. Kaneo is for teams who want a clean experience they can actually own.",
  faq: [
    {
      question: "Can Linear be self-hosted?",
      answer:
        "No. Linear is a closed-source SaaS product with no self-hosted or on-premise edition. If running the tracker on your own infrastructure is a requirement, you need an open-source tool such as Kaneo, Plane, or Huly.",
    },
    {
      question: "What is the best open-source Linear alternative?",
      answer:
        "Kaneo, Plane, and Huly are the three usually named. Kaneo is MIT licensed and the smallest of the three to run and understand. Plane is AGPL and larger. Huly is EPL-2.0 and bundles chat, documents, and HR alongside tracking.",
    },
    {
      question: "Does Kaneo have keyboard shortcuts and a fast UI?",
      answer:
        "Yes. Kaneo is built as a single-page React app with realtime updates over WebSockets, so boards stay in sync without reloads. It is deliberately smaller in scope than Linear, which is what keeps it quick.",
    },
    {
      question: "How does Kaneo pricing compare to Linear?",
      answer:
        "Kaneo is free to self-host with every feature including SSO, and its cloud is $4 a month for one user or $5 per user a month for teams. Linear is priced per user with a free tier capped by issue count, and SSO on its paid plans.",
    },
  ],
  related: ["jira", "plane", "huly", "shortcut"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Linear pricing", href: "https://linear.app/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
