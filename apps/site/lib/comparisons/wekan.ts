import type { Comparison } from "./types";

export const wekan: Comparison = {
  slug: "wekan",
  competitor: "WeKan",
  category: "open-source",
  title: "WeKan alternative",
  description:
    "Kaneo is an MIT-licensed WeKan alternative: the same open kanban freedom on a modern stack, with backlog planning, roles, and time tracking built in.",
  summary: "The same MIT freedom on PostgreSQL, with a backlog and roles.",
  heading: "The WeKan alternative on a modern stack",
  subheading:
    "WeKan has kept open-source kanban alive for years, on Meteor and MongoDB. Kaneo is the same freedom on PostgreSQL, with a backlog, roles, and time tracking.",
  verdict:
    "Kaneo and WeKan are both MIT-licensed, self-hostable kanban tools. WeKan is the long-standing Trello-style board built on Meteor and MongoDB. Kaneo is newer, built on PostgreSQL with a React front end, and adds backlog planning, workspace roles, time tracking, and an official managed cloud.",
  facts: {
    license: "MIT for both",
    hosting: "Both self-host. Kaneo uses PostgreSQL, WeKan uses MongoDB",
    sso: "Free on both, through OIDC",
    pricing: "$0 self-hosted, Kaneo Cloud from $4 / month",
  },
  rows: [
    { feature: "License", kaneo: "MIT", them: "MIT" },
    { feature: "Self-hostable", kaneo: true, them: true },
    { feature: "Database", kaneo: "PostgreSQL", them: "MongoDB" },
    { feature: "Kanban boards", kaneo: true, them: true },
    { feature: "Backlog planning", kaneo: true, them: false },
    { feature: "Workspace roles", kaneo: true, them: "Board permissions" },
    { feature: "Time tracking", kaneo: true, them: false },
    { feature: "Official cloud", kaneo: true, them: false },
  ],
  reasons: [
    {
      title: "A stack your ops team already knows",
      body: "PostgreSQL, one container, Docker Compose or Helm. Backups and upgrades look like everything else you run.",
    },
    {
      title: "Structure beyond the board",
      body: "Workspaces, projects, a backlog, workflow rules, roles, and time entries, so planning does not have to happen in a spreadsheet next to the board.",
    },
    {
      title: "Same licence, no compromise",
      body: "Both projects are MIT. Choosing Kaneo does not cost you any of the freedom WeKan gives you.",
    },
  ],
  honestNote:
    "WeKan has been around far longer, supports a long list of deployment targets including Snap and Sandstorm, and has a card model with swimlanes that some teams specifically want. If it is running well for you, it owes you nothing.",
  faq: [
    {
      question: "Is WeKan still maintained?",
      answer:
        "Yes, WeKan is actively developed and MIT licensed, with frequent releases. Its Meteor and MongoDB stack is the main practical difference from newer tools.",
    },
    {
      question: "WeKan or Kaneo?",
      answer:
        "Pick WeKan if you want a pure Trello-style board with swimlanes and the widest range of install methods. Pick Kaneo if you want backlog planning, workspace roles, time tracking, and a PostgreSQL stack, or if you want a managed cloud option.",
    },
    {
      question: "Do both support single sign-on?",
      answer:
        "Yes. WeKan supports OAuth2 and OIDC providers, and Kaneo supports Google, GitHub, Discord, and any OIDC provider on every build at no cost.",
    },
    {
      question: "Can I migrate WeKan boards to Kaneo?",
      answer:
        "There is no dedicated importer. WeKan can export boards to JSON and Kaneo has a per-project JSON import plus a documented API, so a scripted move is realistic.",
    },
  ],
  related: ["planka", "kanboard", "trello", "focalboard"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "WeKan", href: "https://wekan.github.io/" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
