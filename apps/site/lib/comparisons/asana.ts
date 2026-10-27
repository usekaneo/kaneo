import type { Comparison } from "./types";

export const asana: Comparison = {
  slug: "asana",
  competitor: "Asana",
  category: "saas",
  title: "Simpler Asana alternative",
  description:
    "Kaneo covers boards, backlog, Gantt, and time tracking with every feature on every plan. Kaneo Cloud runs it for you from $4 a month, 14-day free trial.",
  summary: "No two-user free tier, and every feature on every Kaneo plan.",
  heading: "The simpler Asana alternative",
  subheading:
    "Asana's free plan now stops at two people, and single sign-on only arrives at the Enterprise tier. Kaneo Cloud gives every team the same product from $4 a month, and self-hosted Kaneo includes single sign-on for free.",
  verdict:
    "Kaneo is an Asana alternative for teams that want boards, backlog, and timelines in one simple tracker, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams. Asana is cloud-only, priced per user from $10.99 a month, and keeps SAML single sign-on for its Enterprise tier, while Kaneo covers boards, backlog, Gantt and calendar views, custom fields, workflows, roles, and time tracking, leaving Asana's portfolios, goals, and workload views out of scope. Asana is not open source and cannot be self-hosted, but Kaneo is MIT licensed, so you can always run it yourself for free.",
  facts: {
    license: "MIT, versus a proprietary licence for Asana",
    hosting:
      "EU-hosted Kaneo Cloud, or self-host anywhere. Asana is cloud only",
    sso: "Free on every Kaneo build, Enterprise tier on Asana",
    pricing: "Cloud from $4 / month, or $0 self-hosted",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: false },
    { feature: "Own your data", kaneo: true, them: false },
    {
      feature: "Free tier",
      kaneo: "Unlimited, self-hosted",
      them: "Up to 2 users",
    },
    { feature: "SSO included", kaneo: "Free", them: "Enterprise" },
    { feature: "Time tracking", kaneo: true, them: "Paid tiers" },
    { feature: "Learning curve", kaneo: "Minutes", them: "Moderate" },
    {
      feature: "Cloud pricing",
      kaneo: "From $4/mo",
      them: "From $10.99/user/mo",
    },
  ],
  reasons: [
    {
      title: "The free tier is the whole product",
      body: "Self-hosted Kaneo has no seat cap and no feature gates. Asana's Personal plan tops out at two users and holds back timeline, forms, and automations.",
    },
    {
      title: "Single sign-on without a sales call",
      body: "Connect Google, GitHub, Discord, or any OIDC provider on any Kaneo build. Asana puts SAML behind Enterprise, which is quote-only pricing.",
    },
    {
      title: "Work, not work management",
      body: "Kaneo brings boards, backlog, Gantt and calendar planning, custom fields, workflow rules, and time tracking together. Teams can organise tasks and schedules without setting up a portfolio reporting layer.",
    },
  ],
  honestNote:
    "Asana is genuinely strong at cross-team coordination: portfolios, goals, workload balancing, and approval flows for a marketing or operations org. If a program manager needs to see fifty projects roll up into one status view, Asana does that and Kaneo does not.",
  faq: [
    {
      question: "Is Asana open source?",
      answer:
        "No. Asana is proprietary software under a commercial licence, sold only as a hosted service. Kaneo is an open-source alternative under the MIT license that you can run on your own server.",
    },
    {
      question: "Is there an open-source alternative to Asana?",
      answer:
        "Yes. Kaneo is MIT licensed and free to self-host with unlimited users. Other open-source options include OpenProject, Plane, Taiga, and Leantime. None of them replicate Asana's portfolio and goals layer, which is usually the point of switching.",
    },
    {
      question: "Can Asana be self-hosted?",
      answer:
        "No. Asana is a hosted SaaS product with no on-premise edition. If your requirement is keeping project data on infrastructure you control, you need a different tool.",
    },
    {
      question: "How many users does Asana's free plan allow?",
      answer:
        "Asana's Personal plan is limited to 2 users. Paid plans start at $10.99 per user a month billed annually for Starter and $24.99 for Advanced, with SAML SSO first appearing on Enterprise.",
    },
    {
      question: "Does Kaneo have time tracking like Asana?",
      answer:
        "Yes. Time entries are built into Kaneo tasks on every build, including the free self-hosted one. In Asana, time tracking is a paid-tier feature.",
    },
  ],
  related: ["clickup", "monday", "jira", "notion"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Asana pricing", href: "https://asana.com/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
