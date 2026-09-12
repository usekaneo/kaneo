import type { Comparison } from "./types";

export const notion: Comparison = {
  slug: "notion",
  competitor: "Notion",
  category: "saas",
  title: "Open-source Notion alternative for project management",
  description:
    "Kaneo is an open-source, self-hostable alternative to Notion for project tracking: real boards, backlog, and workflows instead of databases you have to build yourself.",
  summary:
    "A real tracker instead of a task database somebody has to maintain.",
  heading: "The open-source Notion alternative for running projects",
  subheading:
    "Notion is a wonderful place to write and a fiddly place to track work. Kaneo is a purpose-built tracker you can self-host, so nobody has to maintain the board that runs your team.",
  verdict:
    "Kaneo is an open-source, MIT-licensed alternative to Notion for project tracking specifically. Where Notion asks you to build a task database and keep it working, Kaneo ships boards, backlog, workflow columns, roles, and time tracking as product features. Kaneo is not a replacement for Notion's docs and wiki.",
  facts: {
    license: "MIT, versus a proprietary licence for Notion",
    hosting: "Self-host anywhere, or EU-hosted cloud. Notion is cloud only",
    sso: "Free on every Kaneo build, Business tier on Notion",
    pricing: "$0 self-hosted, cloud from $4 / month",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: false },
    { feature: "Own your data", kaneo: true, them: false },
    {
      feature: "Purpose-built tracker",
      kaneo: true,
      them: "Build it yourself",
    },
    { feature: "Docs & wiki", kaneo: false, them: true },
    { feature: "SSO included", kaneo: "Free", them: "Business" },
    { feature: "Time tracking", kaneo: true, them: false },
    {
      feature: "Cloud pricing",
      kaneo: "From $4/mo",
      them: "From $10/member/mo",
    },
  ],
  reasons: [
    {
      title: "Nobody has to be the Notion admin",
      body: "A Notion task system is somebody's side project: templates, rollups, relations, and the person who fixes it when a view breaks. Kaneo's board works the same way for every project, on day one.",
    },
    {
      title: "Built for a working week",
      body: "Backlog planning, workflow columns, priorities, assignees, due dates, and time entries are features, not database properties you configure and then maintain.",
    },
    {
      title: "Self-hosted and exportable",
      body: "Run Kaneo on your own hardware under the MIT license, and export any project to JSON from the UI whenever you want.",
    },
  ],
  honestNote:
    "Notion is excellent at what it is: a flexible workspace for documents, wikis, and lightweight databases. If your team lives in written docs and the task list is a side-effect of that, stay in Notion. Kaneo is worth it when the tracking part has become the point and the database keeps getting in the way.",
  faq: [
    {
      question: "Is there an open-source alternative to Notion?",
      answer:
        "For documents and wikis, look at AppFlowy, Outline, Docmost, or AnyType. For the project-tracking half of Notion, Kaneo is MIT licensed, self-hostable, and purpose-built for boards and backlogs.",
    },
    {
      question: "Can Notion be self-hosted?",
      answer:
        "No. Notion is cloud-only, and its Enterprise tier adds controls rather than an installable build. Self-hosting requires a different tool.",
    },
    {
      question: "Is Notion good for project management?",
      answer:
        "It works, but you build and maintain it. Boards, sprints, and rollups are database views you assemble yourself, and they drift as the team grows. A dedicated tracker gives you the same views without the upkeep.",
    },
    {
      question: "What does Notion cost, and when do you get SSO?",
      answer:
        "Notion is free for personal use with limits on uploads, history, and guests. Plus is $10 per member a month and Business is $20, where SAML single sign-on first appears. Kaneo includes SSO on every build, including the free self-hosted one.",
    },
  ],
  related: ["clickup", "trello", "asana", "huly"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Notion pricing", href: "https://www.notion.com/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
