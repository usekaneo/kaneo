import type { Comparison } from "./types";

export const kanboard: Comparison = {
  slug: "kanboard",
  competitor: "Kanboard",
  category: "open-source",
  title: "Modern Kanboard alternative",
  description:
    "Kaneo is a Kanboard alternative with a modern interface, realtime boards, and team features. Kaneo Cloud runs it for you from $4 a month, or self-host it.",
  summary: "The same small footprint, with an interface people will open.",
  heading: "The Kanboard alternative with a modern interface",
  subheading:
    "Kanboard is admirably small and famously plain. Kaneo keeps the small footprint and gives your team something they will want to look at every day.",
  verdict:
    "Kaneo is a Kanboard alternative for teams that want a modern interface, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams. Kanboard is a minimal PHP application that runs almost anywhere, including on SQLite, while Kaneo is a modern React and PostgreSQL app with realtime boards, workspace roles, time tracking, and integrations. Both are MIT licensed, so you can still self-host Kaneo in minutes.",
  facts: {
    license: "MIT for both",
    hosting:
      "EU-hosted Kaneo Cloud, or Docker plus PostgreSQL. Kanboard is PHP with SQLite or MySQL",
    sso: "Built into Kaneo, plugin-based on Kanboard",
    pricing: "Kaneo Cloud from $4 / month, or $0 self-hosted for both",
  },
  rows: [
    { feature: "License", kaneo: "MIT", them: "MIT" },
    { feature: "Self-hostable", kaneo: true, them: true },
    { feature: "Interface", kaneo: "Modern", them: "Minimal" },
    { feature: "Realtime updates", kaneo: true, them: false },
    { feature: "OIDC single sign-on", kaneo: "Built in", them: "Plugin" },
    { feature: "Backlog planning", kaneo: true, them: false },
    { feature: "Time tracking", kaneo: true, them: true },
    { feature: "Official cloud", kaneo: true, them: false },
  ],
  reasons: [
    {
      title: "Adoption, not just installation",
      body: "Kanboard installs in minutes and then people avoid opening it. Kaneo is built to be the tab your team actually keeps open.",
    },
    {
      title: "Team features in the core",
      body: "Workspaces, roles, notifications, integrations, and SSO come with Kaneo rather than arriving as separate plugins to keep updated.",
    },
    {
      title: "Still small",
      body: "One container plus PostgreSQL, with a Helm chart if you are on Kubernetes. Kaneo is not the heavy option in this comparison.",
    },
  ],
  honestNote:
    "Kanboard's footprint is remarkable: PHP, an SQLite file if you want, and it will run happily on the cheapest VPS you own for years without attention. If minimal resource use and total simplicity are what you value, it is hard to beat.",
  faq: [
    {
      question: "Is Kanboard still maintained?",
      answer:
        "Yes. Kanboard is MIT licensed and still receives releases. Its design is deliberately conservative, and much of its extra functionality comes from community plugins.",
    },
    {
      question: "Kanboard or Kaneo for a small team?",
      answer:
        "Kanboard if you want the smallest possible install and do not mind a plain interface. Kaneo if you want realtime boards, backlog planning, roles, and SSO without assembling plugins.",
    },
    {
      question: "What are Kaneo's system requirements?",
      answer:
        "A small VPS is enough. Kaneo runs as a single container alongside PostgreSQL, and there is a Helm chart for Kubernetes deployments.",
    },
    {
      question: "Does Kaneo have a plugin system?",
      answer:
        "No. Kaneo extends through its public API, outgoing webhooks, API keys, and an MCP server rather than in-process plugins.",
    },
  ],
  related: ["wekan", "planka", "vikunja", "redmine"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Kanboard", href: "https://kanboard.org/" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
