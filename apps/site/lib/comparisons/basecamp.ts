import type { Comparison } from "./types";

export const basecamp: Comparison = {
  slug: "basecamp",
  competitor: "Basecamp",
  category: "saas",
  title: "Open-source Basecamp alternative",
  description:
    "Kaneo is an open-source, self-hostable Basecamp alternative with real boards and a backlog, free to run yourself under the MIT license.",
  summary:
    "Boards and a backlog for shipping software, hosted by you rather than 37signals.",
  heading: "The open-source Basecamp alternative",
  subheading:
    "Basecamp is calm, opinionated, and hosted by Basecamp. Kaneo is calm, opinionated, and hosted by you, with a board and backlog built for shipping software.",
  verdict:
    "Kaneo is an open-source, MIT-licensed alternative to Basecamp that you can run on your own server for free. Basecamp charges a flat monthly fee with no per-user pricing, which is a genuinely good deal for larger teams, but it is cloud-only and organised around message boards and to-do lists rather than a kanban board and backlog.",
  facts: {
    license: "MIT, versus a proprietary licence for Basecamp",
    hosting: "Self-host anywhere, or EU-hosted cloud. Basecamp is cloud only",
    sso: "Google, GitHub, Discord, or any OIDC provider, free on Kaneo",
    pricing: "$0 self-hosted, cloud from $4 / month. Basecamp is flat-rate",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: false },
    { feature: "Own your data", kaneo: true, them: false },
    {
      feature: "Kanban board & backlog",
      kaneo: true,
      them: "Card table, to-dos",
    },
    { feature: "Message boards & chat", kaneo: false, them: true },
    { feature: "Time tracking", kaneo: true, them: "Higher tiers" },
    { feature: "Pricing model", kaneo: "Free or per user", them: "Flat rate" },
    { feature: "Cloud pricing", kaneo: "From $4/mo", them: "From $25/mo flat" },
  ],
  reasons: [
    {
      title: "Made for shipping software",
      body: "Backlog, workflow columns, priorities, task relations, and time entries. Basecamp's to-do lists and card table are deliberately looser than that.",
    },
    {
      title: "Runs on your infrastructure",
      body: "Basecamp has been hosted-only since Basecamp 3. Kaneo installs with Docker and PostgreSQL on any box you control, under the MIT license.",
    },
    {
      title: "Free when you host it",
      body: "A self-hosted Kaneo instance costs you a server. Basecamp's flat rate is fair at scale but starts at $25 a month whether you are two people or twenty.",
    },
  ],
  honestNote:
    "Basecamp's flat pricing and its all-in-one approach to client work, messages, docs, and check-ins are hard to beat if that is how your company communicates. Kaneo has no message boards, no campfire chat, and no client access. If Basecamp is your intranet, keep it.",
  faq: [
    {
      question: "Can Basecamp be self-hosted?",
      answer:
        "Not the current version. Basecamp has been a hosted product since Basecamp 3, and the older self-installable Basecamp Classic is long retired. Once On-Premise was 37signals' answer for self-hosting Campfire and similar apps, not for Basecamp itself.",
    },
    {
      question: "What does Basecamp cost?",
      answer:
        "Basecamp is flat-rate rather than per user: a free tier, then Freelancer at $25 a month, Studio at $59, Pro at $100, and Unlimited at $300 a month billed annually, with everyone on the account included.",
    },
    {
      question: "Is there an open-source Basecamp alternative?",
      answer:
        "Kaneo, Leantime, OpenProject, and Taiga are the usual open-source options. Kaneo is the closest if what you want is a fast board and backlog. Leantime is closer if you want goals and light client-facing structure.",
    },
    {
      question: "Does Kaneo have Basecamp's message boards?",
      answer:
        "No. Kaneo has task comments, notifications, and integrations with Slack, Discord, and Telegram, but no standalone message board or group chat. It assumes your team already talks somewhere else.",
    },
  ],
  related: ["trello", "asana", "leantime", "notion"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Basecamp pricing", href: "https://basecamp.com/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
