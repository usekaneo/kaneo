import type { Comparison } from "./types";

export const leantime: Comparison = {
  slug: "leantime",
  competitor: "Leantime",
  category: "open-source",
  title: "Leantime alternative",
  description:
    "Kaneo is an MIT-licensed Leantime alternative focused on shipping work: boards, backlog, workflows, and time tracking, self-hosted for free.",
  summary: "The tracker underneath, without the goals and strategy layer.",
  heading: "The MIT-licensed Leantime alternative",
  subheading:
    "Leantime wraps goals, research boards, and strategy around your tasks. Kaneo is the tracker underneath, without the strategy layer, and it is MIT licensed.",
  verdict:
    "Kaneo and Leantime are both open-source and self-hostable. Leantime is AGPLv3, aimed at non-project-managers, and layers goals, ideas, and retrospectives on top of task management. Kaneo is MIT licensed and stays a focused tracker with boards, backlog, workflow rules, roles, and time tracking.",
  facts: {
    license: "MIT, versus AGPLv3 for the Leantime community edition",
    hosting:
      "Both self-host. Kaneo is Docker plus PostgreSQL, Leantime is PHP plus MySQL",
    sso: "Free on every Kaneo build",
    pricing: "$0 self-hosted for both, Kaneo Cloud from $4 / month",
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
