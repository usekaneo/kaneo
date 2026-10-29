import type { Comparison } from "./types";

export const wekan: Comparison = {
  slug: "wekan",
  competitor: "WeKan",
  category: "open-source",
  title: "WeKan alternative on a modern stack",
  description:
    "Kaneo is a WeKan alternative on a modern stack, with backlog planning, roles, and time tracking built in. Kaneo Cloud runs it for you from $4 a month.",
  summary: "A backlog and roles on a modern stack, run for you on Kaneo Cloud.",
  heading: "The WeKan alternative on a modern stack",
  subheading:
    "WeKan has kept open-source kanban alive for years, on Meteor and MongoDB. Kaneo runs on PostgreSQL with a backlog, roles, and time tracking, and Kaneo Cloud hosts it for you.",
  verdict:
    "Kaneo is a WeKan alternative on a modern stack, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams, so there is nothing to maintain. WeKan is the long-standing Trello-style board built on Meteor and MongoDB, while Kaneo is newer, built on PostgreSQL with a React front end, and adds backlog planning, workspace roles, and time tracking. Both are MIT licensed and self-hostable, so you can always run Kaneo yourself.",
  facts: {
    license: "MIT for both",
    hosting:
      "EU-hosted Kaneo Cloud. Both self-host, Kaneo on PostgreSQL, WeKan on MongoDB",
    sso: "Free on both, through OIDC",
    pricing: "Kaneo Cloud from $4 / month, or $0 self-hosted",
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
