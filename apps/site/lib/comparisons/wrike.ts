import type { Comparison } from "./types";

export const wrike: Comparison = {
  slug: "wrike",
  competitor: "Wrike",
  category: "saas",
  title: "Simpler Wrike alternative",
  description:
    "Kaneo is a simpler Wrike alternative with no user bands and every feature on every plan. Kaneo Cloud runs it for you from $4 a month, 14-day free trial.",
  summary: "One feature set instead of user bands and tier maths.",
  heading: "The simpler Wrike alternative",
  subheading:
    "Wrike prices in user bands and sells the good parts by tier. Kaneo is one product with every feature on every plan, and Kaneo Cloud runs it for you.",
  verdict:
    "Kaneo is a simpler Wrike alternative, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams, with every feature on every plan. Wrike is cloud-first, priced per user from $10 a month with plan-specific user ranges, and aimed at larger operations teams, while Kaneo trades Wrike's resource management and proofing for a simpler tracker. Kaneo is also MIT-licensed open source, so you can run it on your own infrastructure at no cost.",
  facts: {
    license: "MIT, versus a proprietary licence for Wrike",
    hosting: "EU-hosted Kaneo Cloud, or self-host anywhere",
    sso: "Free on every Kaneo build, higher tiers on Wrike",
    pricing: "Cloud from $4 / month, or $0 self-hosted",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: false },
    { feature: "Own your data", kaneo: true, them: false },
    { feature: "User bands per plan", kaneo: "None", them: "2-15, 5-200" },
    { feature: "SSO included", kaneo: "Free", them: "Higher tiers" },
    { feature: "Time tracking", kaneo: true, them: "Business and up" },
    { feature: "Resource management", kaneo: false, them: true },
    { feature: "Cloud pricing", kaneo: "From $4/mo", them: "From $10/user/mo" },
  ],
  reasons: [
    {
      title: "No tier maths",
      body: "Wrike's Team plan stops at 15 users and Business starts at 5, so growing teams get moved between plans. Kaneo has one feature set and you pick where it runs.",
    },
    {
      title: "Your data, your servers",
      body: "Install Kaneo with Docker under the MIT license and keep every task, comment, and attachment inside your own network.",
    },
    {
      title: "Fast to adopt",
      body: "New people find their way around a Kaneo board without training. Wrike's folder, project, and task hierarchy usually needs an internal champion.",
    },
  ],
  honestNote:
    "Wrike is built for larger marketing, professional services, and operations teams that need request forms, proofing, resource allocation, and time-and-budget reporting in one place. Kaneo has none of that. If you are running billable client work at scale, Wrike is the more complete product.",
  faq: [
    {
      question: "Can Wrike be self-hosted?",
      answer:
        "No. Wrike is delivered as SaaS with regional data-centre options and enterprise security controls, but there is no on-premise installation for general customers.",
    },
    {
      question: "What does Wrike cost?",
      answer:
        "Wrike has a free plan, then Team at $10 per user a month for 2 to 15 users and Business at $25 per user a month for 5 to 200 users, with Pinnacle and Apex quoted by sales.",
    },
    {
      question: "Is there an open-source alternative to Wrike?",
      answer:
        "Kaneo and OpenProject are the two most often suggested. OpenProject is closer to Wrike in scope, with Gantt charts and cost reporting. Kaneo is closer if you want a light tracker your team will actually keep updated.",
    },
    {
      question: "Does Kaneo do resource management?",
      answer:
        "No. Kaneo tracks time spent per task and shows workload through boards and assignees, but it has no capacity planning, allocation, or billing model.",
    },
  ],
  related: ["monday", "asana", "openproject", "jira"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Wrike pricing", href: "https://www.wrike.com/price/" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
