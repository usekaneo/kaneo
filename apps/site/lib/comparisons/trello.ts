import type { Comparison } from "./types";

export const trello: Comparison = {
  slug: "trello",
  competitor: "Trello",
  category: "saas",
  title: "Open-source Trello alternative: Kaneo vs Trello",
  description:
    "Kaneo is a free, open-source Trello alternative under the MIT license. Keep the simple kanban board, add a backlog and workflows, and host it yourself.",
  summary:
    "Keeps the simple board, adds a backlog and workflows, and runs on your server.",
  heading: "The open-source, self-hostable Trello alternative",
  subheading:
    "Trello nails simple kanban, but your boards live on someone else's servers and grow into paid Power-Ups. Kaneo keeps the simplicity, adds backlog and workflows, and lets you own the whole thing.",
  verdict:
    "Kaneo is a self-hostable, MIT-licensed Trello alternative. It keeps the drag-and-drop board Trello is loved for and adds backlog planning, configurable workflows, roles, and time tracking without Power-Ups. Self-hosting is free and unlimited, and the managed cloud starts at $4 a month.",
  facts: {
    license: "MIT, versus a proprietary licence for Trello",
    hosting: "Self-host anywhere, or EU-hosted cloud",
    sso: "Free on every Kaneo build, Enterprise-tier on Trello",
    pricing: "$0 self-hosted, cloud from $4 / month",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: false },
    { feature: "Own your data", kaneo: true, them: false },
    { feature: "Kanban boards", kaneo: true, them: true },
    { feature: "Backlog & workflows", kaneo: true, them: "Power-Ups" },
    { feature: "Free to self-host", kaneo: true, them: false },
    { feature: "SSO included", kaneo: "Free", them: "Enterprise" },
    { feature: "Cloud pricing", kaneo: "From $4/mo", them: "Per user" },
  ],
  reasons: [
    {
      title: "Just as simple",
      body: "A clean board you can use in minutes, with no manual and no onboarding wizard. Kaneo keeps the thing people love about Trello.",
    },
    {
      title: "Room to grow",
      body: "Backlog planning, custom workflows, and roles are built in, so you don't hit a wall and start bolting on paid Power-Ups.",
    },
    {
      title: "Your boards, your servers",
      body: "Self-host under MIT for free, or use our managed cloud. Your data is exportable and never locked in.",
    },
  ],
  migration: {
    body: "Kaneo imports your Trello boards from the app: authorize Trello, pick the boards, and lists, cards, checklists, dates, labels, members, comments, and archived cards come across.",
    href: "https://kaneo.app/docs/core/migrations/from-trello",
    linkText: "Read the import guide",
  },
  honestNote:
    "If you only need a couple of personal boards, never want to self-host, and Trello's free tier covers you, it's a perfectly good choice. Kaneo makes more sense the moment you care about owning your data or your team outgrows a simple board.",
  faq: [
    {
      question: "Is Trello open source?",
      answer:
        "No. Trello is proprietary software owned by Atlassian and runs only as a cloud service. Kaneo, WeKan, and Kanboard are MIT-licensed kanban boards whose code you can read, change, and run yourself for free.",
    },
    {
      question: "Can you self-host Trello?",
      answer:
        "No. Trello is a hosted Atlassian product with no on-premise edition, so the only way to run a Trello-style board on your own server is to use a different tool. Kaneo, WeKan, Kanboard, and PLANKA are the common self-hosted choices.",
    },
    {
      question: "What is the best open-source Trello alternative?",
      answer:
        "It depends on how far you expect to grow. WeKan and Kanboard stay close to a pure board. Kaneo adds backlog planning, workflows, roles, time tracking, and an API while keeping the board simple, and it is MIT licensed with SSO included.",
    },
    {
      question: "Can I import my Trello boards into Kaneo?",
      answer:
        "Yes. In Settings, open Workspace, then Import, choose Trello, and authorize Kaneo to read your boards. Lists, cards, checklists, dates, labels, members, comments, and archived cards carry over. Attachments, custom fields, and Power-Up data do not.",
    },
    {
      question: "Is Kaneo free?",
      answer:
        "Self-hosting Kaneo is free forever under the MIT license, with unlimited users and projects and no feature gates. The managed cloud is $4 a month for one person or $5 per user a month for a team, after a 14-day trial.",
    },
  ],
  related: ["planka", "wekan", "kanboard", "notion"],
  guides: [
    {
      label: "Self-hosted Trello alternatives compared",
      href: "/guides/self-hosted-trello-alternatives",
    },
    {
      label: "Best Trello alternatives, including paid tools",
      href: "/blog/best-trello-alternatives",
    },
  ],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Trello pricing", href: "https://trello.com/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
