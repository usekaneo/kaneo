import type { Comparison } from "./types";

export const taiga: Comparison = {
  slug: "taiga",
  competitor: "Taiga",
  category: "open-source",
  title: "Simpler Taiga alternative",
  description:
    "Kaneo is a simpler Taiga alternative with a board and backlog and no Scrum ceremony. Kaneo Cloud runs it for you from $4 a month, with nothing to maintain.",
  summary: "A board and backlog without adopting Scrum first.",
  heading: "The simpler Taiga alternative",
  subheading:
    "Taiga is built around Scrum and Kanban done properly, sprints, story points, and all. Kaneo is for teams who want to plan and ship without adopting a methodology first.",
  verdict:
    "Kaneo is a simpler Taiga alternative for teams that want to plan and ship without adopting a methodology first, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams. Taiga is MPL-2.0 and organised around agile ceremonies, with sprints, story points, and burndown charts, while Kaneo keeps a board, a backlog, workflow columns, and time tracking, and leaves the methodology to you. Both are open source, and Kaneo is MIT licensed, so you can self-host it any time.",
  facts: {
    license: "MIT, versus MPL-2.0 for Taiga",
    hosting:
      "EU-hosted Kaneo Cloud. Both self-host, Kaneo as a single container plus PostgreSQL",
    sso: "Free on every Kaneo build",
    pricing: "Kaneo Cloud from $4 / month, or $0 self-hosted for both",
  },
  rows: [
    { feature: "License", kaneo: "MIT", them: "MPL-2.0" },
    { feature: "Self-hostable", kaneo: true, them: true },
    { feature: "Free to self-host", kaneo: true, them: true },
    { feature: "Sprints & story points", kaneo: false, them: true },
    { feature: "Backlog planning", kaneo: true, them: true },
    { feature: "Time tracking", kaneo: true, them: false },
    {
      feature: "Install footprint",
      kaneo: "One container + Postgres",
      them: "Multi-service",
    },
    {
      feature: "Learning curve",
      kaneo: "Minutes",
      them: "Agile concepts first",
    },
  ],
  reasons: [
    {
      title: "No methodology tax",
      body: "Kaneo does not ask you to size stories or open a sprint before work can move. Columns, priorities, and a backlog are enough for most teams.",
    },
    {
      title: "Smaller to run",
      body: "Taiga's self-hosted stack is several services. Kaneo is one container plus PostgreSQL, with a Helm chart for Kubernetes.",
    },
    {
      title: "Time tracking included",
      body: "Log time against tasks in the free build. Taiga leaves time tracking to plugins and external tools.",
    },
  ],
  honestNote:
    "Taiga is a well-established agile tool with proper sprint management, story points, burndown charts, and an epics model, and it is free to self-host under MPL-2.0. If your team genuinely runs Scrum, Taiga supports that far better than Kaneo does.",
  faq: [
    {
      question: "Is Taiga free and open source?",
      answer:
        "Yes. Taiga is open source under MPL-2.0 and free to self-host with no user limits. Taiga also offers a cloud with a free tier and paid support options.",
    },
    {
      question: "Taiga or Kaneo?",
      answer:
        "Taiga if you run Scrum with sprints, story points, and burndowns. Kaneo if you want a board and backlog without ceremony, plus time tracking and single sign-on in a smaller install.",
    },
    {
      question: "Does Kaneo support sprints?",
      answer:
        "Not as a first-class concept. Kaneo has backlog planning and workflow columns, which many teams use to run iterations informally, but there are no sprint objects, story points, or burndown charts.",
    },
    {
      question: "Which is easier to self-host?",
      answer:
        "Kaneo. It is a single container plus PostgreSQL, deployable with Docker Compose or the official Helm chart. Taiga's standard deployment runs several coordinated services.",
    },
  ],
  related: ["openproject", "jira", "redmine", "plane"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Taiga", href: "https://taiga.io/" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
