import type { Comparison } from "./types";

export const leantime: Comparison = {
  slug: "leantime",
  competitor: "Leantime",
  category: "open-source",
  title: "Focused Leantime alternative",
  description:
    "Kaneo is a focused Leantime alternative: boards, backlog, workflows, and time tracking. Kaneo Cloud runs it for you from $4 a month, nothing to maintain.",
  summary: "The tracker underneath, without the goals and strategy layer.",
  heading: "The focused Leantime alternative",
  subheading:
    "Leantime wraps goals, research boards, and strategy around your tasks. Kaneo is the tracker underneath, without the strategy layer, and Kaneo Cloud runs it for you.",
  verdict:
    "Kaneo is a focused Leantime alternative for teams that want a tracker without the strategy layer, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams, with nothing to maintain. Leantime is AGPLv3, aimed at non-project-managers, and layers goals, ideas, and retrospectives on top of task management, while Kaneo stays a focused tracker with boards, backlog, workflow rules, roles, and time tracking. Both are open source, and Kaneo is MIT licensed, so you can self-host it any time.",
  facts: {
    license: "MIT, versus AGPLv3 for the Leantime community edition",
    hosting:
      "EU-hosted Kaneo Cloud. Both self-host, Kaneo on Docker plus PostgreSQL, Leantime on PHP plus MySQL",
    sso: "Free on every Kaneo build",
    pricing: "Kaneo Cloud from $4 / month, or $0 self-hosted for both",
  },
  rows: [
    { feature: "License", kaneo: "MIT", them: "AGPLv3" },
    { feature: "Self-hostable", kaneo: true, them: true },
    { feature: "Free to self-host", kaneo: true, them: true },
    { feature: "Goals & strategy boards", kaneo: false, them: true },
    { feature: "Backlog planning", kaneo: true, them: true },
    { feature: "Time tracking", kaneo: true, them: true },
    { feature: "Stack", kaneo: "Node + PostgreSQL", them: "PHP + MySQL" },
    { feature: "Cloud pricing", kaneo: "From $4/mo", them: "Per user" },
  ],
  reasons: [
    {
      title: "A tracker, not a framework",
      body: "Leantime asks you to define goals, ideas, and research before the work. Kaneo assumes you know what needs doing and want somewhere to do it.",
    },
    {
      title: "Permissive licence",
      body: "MIT rather than AGPLv3, so forking Kaneo or building a product around it stays simple.",
    },
    {
      title: "Modern stack, small footprint",
      body: "Kaneo is one container plus PostgreSQL with realtime board updates, an official Helm chart, and a documented public API.",
    },
  ],
  honestNote:
    "Leantime is thoughtfully designed for people who do not think in tickets, and it was built with ADHD, autism, and dyslexia explicitly in mind. Its goals, ideas, and retrospective boards give small teams a structure Kaneo simply does not have. If that framing is what your team needs, Leantime is the better tool.",
  faq: [
    {
      question: "Is Leantime free?",
      answer:
        "The self-hosted community edition is free and open source under AGPLv3, and matches the features of the hosted Core plan. Leantime's cloud is priced per user.",
    },
    {
      question: "Leantime or Kaneo?",
      answer:
        "Leantime if you want goal setting, idea boards, and retrospectives around your tasks. Kaneo if you want a fast board and backlog with roles, time tracking, and integrations, under a permissive licence.",
    },
    {
      question: "What does Kaneo run on?",
      answer:
        "A single container running the Hono API and React front end, plus PostgreSQL. Redis is optional and only needed to coordinate realtime delivery across several API instances.",
    },
    {
      question: "Does Kaneo have retrospectives or goal tracking?",
      answer:
        "No. Kaneo has projects, boards, backlog, labels, priorities, task relations, comments, and time entries. Goals and retrospectives are outside its scope by design.",
    },
  ],
  related: ["openproject", "basecamp", "vikunja", "monday"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Leantime pricing", href: "https://leantime.io/pricing/" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
