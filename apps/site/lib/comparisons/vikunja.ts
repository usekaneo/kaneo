import type { Comparison } from "./types";

export const vikunja: Comparison = {
  slug: "vikunja",
  competitor: "Vikunja",
  category: "open-source",
  title: "Vikunja alternative for teams",
  description:
    "Kaneo is an MIT-licensed Vikunja alternative built around team projects, with time tracking and workspace roles in the free self-hosted build.",
  summary: "Built for teams, with time tracking and roles in the free build.",
  heading: "The Vikunja alternative built for teams",
  subheading:
    "Vikunja is a lovely self-hosted to-do app, and its Pro tier keeps some features for paying self-hosters. Kaneo is team-first, MIT licensed, and has no Pro tier at all.",
  verdict:
    "Kaneo and Vikunja are both open source and self-hostable, but they aim at different users. Vikunja is a personal and small-team task manager under AGPLv3, with a paid Vikunja Pro add-on for self-hosters that includes features such as time tracking and audit logs. Kaneo is MIT licensed, team-oriented, and ships every feature in the free build.",
  facts: {
    license: "MIT, versus AGPLv3 for Vikunja",
    hosting: "Both self-host. Kaneo is a single container plus PostgreSQL",
    sso: "Free on both, through OIDC",
    pricing: "$0 self-hosted with no paid add-on, cloud from $4 / month",
  },
  rows: [
    { feature: "License", kaneo: "MIT", them: "AGPLv3" },
    { feature: "Self-hostable", kaneo: true, them: true },
    {
      feature: "Paid add-on for self-hosters",
      kaneo: false,
      them: "Vikunja Pro",
    },
    { feature: "Time tracking in free build", kaneo: true, them: "Pro" },
    { feature: "Workspace roles", kaneo: true, them: "Sharing model" },
    { feature: "Kanban boards", kaneo: true, them: true },
    { feature: "Backlog planning", kaneo: true, them: false },
    { feature: "Cloud pricing", kaneo: "From $4/mo", them: "From €4/mo" },
  ],
  reasons: [
    {
      title: "One build, everything included",
      body: "Vikunja Pro adds an admin panel, audit logs, and time tracking for self-hosters who pay. Kaneo's self-hosted build is the whole product, permanently.",
    },
    {
      title: "Team structure, not shared lists",
      body: "Workspaces, projects, roles, and permissions are the core model in Kaneo. Vikunja's sharing works well for a few people and gets thin for a growing team.",
    },
    {
      title: "MIT rather than AGPL",
      body: "AGPL obligations matter if you plan to modify and host a service on top of it. MIT keeps that decision uncomplicated.",
    },
  ],
  honestNote:
    "Vikunja is delightful for personal task management: fast, small, with list, table, gantt, and calendar views and a genuinely nice mobile experience. If you mostly manage your own work and occasionally share a list, Vikunja is probably the better fit, and its cloud is priced kindly.",
  faq: [
    {
      question: "Is Vikunja completely free to self-host?",
      answer:
        "The core is free and open source under AGPLv3. Vikunja Pro is a separate paid offering for self-hosted instances that adds features such as an admin panel, audit logs, and time tracking.",
    },
    {
      question: "Vikunja or Kaneo for a team?",
      answer:
        "Kaneo is built around workspaces, projects, and roles, with backlog planning and time tracking in the free build, so it fits teams better. Vikunja is stronger for individuals and its calendar and list views are more developed.",
    },
    {
      question: "Do both support single sign-on?",
      answer:
        "Yes, both support OIDC providers on their self-hosted builds at no cost, which is not something every tool in this category can say.",
    },
    {
      question: "Which is easier to run?",
      answer:
        "Both are simple. Vikunja is a Go binary with an optional embedded database, which is marginally easier for a single-user install. Kaneo is a container plus PostgreSQL, and ships a Helm chart for Kubernetes.",
    },
  ],
  related: ["planka", "kanboard", "wekan", "leantime"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Vikunja pricing", href: "https://vikunja.io/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
