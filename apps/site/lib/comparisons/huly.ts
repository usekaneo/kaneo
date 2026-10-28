import type { Comparison } from "./types";

export const huly: Comparison = {
  slug: "huly",
  competitor: "Huly",
  category: "open-source",
  title: "Focused Huly alternative",
  description:
    "Kaneo is a focused Huly alternative that does project tracking and nothing else. Kaneo Cloud runs it for you from $4 a month, with nothing to maintain.",
  summary: "Project tracking only, run for you on Kaneo Cloud.",
  heading: "The focused Huly alternative",
  subheading:
    "Huly puts tracking, chat, documents, HR, and CRM in one workspace. Kaneo does the tracking part, and Kaneo Cloud runs it for you.",
  verdict:
    "Kaneo is a focused Huly alternative for teams that only need project tracking, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams, with nothing to maintain. Huly is an all-in-one workspace under EPL-2.0 covering project tracking, chat, documents, HR, and CRM, with a correspondingly large deployment, while Kaneo does project tracking only. Kaneo is also MIT licensed, so you can self-host it as a single container plus PostgreSQL.",
  facts: {
    license: "MIT, versus EPL-2.0 for Huly",
    hosting:
      "EU-hosted Kaneo Cloud, or self-host one container. Huly is a multi-service platform",
    sso: "Free on every Kaneo build",
    pricing: "Cloud from $4 / month, or $0 self-hosted",
  },
  rows: [
    { feature: "License", kaneo: "MIT", them: "EPL-2.0" },
    { feature: "Self-hostable", kaneo: true, them: true },
    {
      feature: "Scope",
      kaneo: "Project tracking",
      them: "All-in-one workspace",
    },
    {
      feature: "Install footprint",
      kaneo: "One container + Postgres",
      them: "Multi-service",
    },
    { feature: "Chat, docs, HR, CRM", kaneo: false, them: true },
    { feature: "Time tracking", kaneo: true, them: true },
    { feature: "Backlog planning", kaneo: true, them: true },
    {
      feature: "Cloud pricing",
      kaneo: "From $4/mo",
      them: "Free tier, then per user",
    },
  ],
  reasons: [
    {
      title: "One job, done properly",
      body: "Kaneo is a tracker. There is no chat to migrate onto, no HR module to keep current, and nothing to disable before your team can start.",
    },
    {
      title: "Realistic to self-host",
      body: "A container and a database, with Docker Compose and a Helm chart. Huly's self-hosted platform has many more services to run and update.",
    },
    {
      title: "MIT licensing",
      body: "Kaneo is MIT throughout, which keeps forking and commercial use uncomplicated compared with EPL-2.0's file-level copyleft.",
    },
  ],
  honestNote:
    "Huly is ambitious in a way that is genuinely appealing: virtual office, chat, documents, and tracking in one place, and it is free to self-host. If replacing several tools at once is the goal, Kaneo is not trying to compete with that.",
  faq: [
    {
      question: "Is Huly open source?",
      answer:
        "Yes. The Huly platform is published under EPL-2.0 and can be self-hosted for free, alongside a hosted cloud with a free tier and paid plans.",
    },
    {
      question: "Huly or Kaneo?",
      answer:
        "Huly if you want one workspace covering chat, documents, HR, and tracking. Kaneo if you want a small, fast tracker you can run and understand, and you already have tools for the rest.",
    },
    {
      question: "How hard is each to self-host?",
      answer:
        "Kaneo is one container plus PostgreSQL, with an official Helm chart. Huly's self-hosted deployment runs a considerably larger set of services and expects more operational attention.",
    },
    {
      question: "Does Kaneo have chat or documents?",
      answer:
        "No. Kaneo has task comments, notifications, and integrations with Slack, Discord, and Telegram. Documents and chat are deliberately out of scope.",
    },
  ],
  related: ["plane", "linear", "notion", "openproject"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Huly pricing", href: "https://huly.io/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
