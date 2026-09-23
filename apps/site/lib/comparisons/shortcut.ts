import type { Comparison } from "./types";

export const shortcut: Comparison = {
  slug: "shortcut",
  competitor: "Shortcut",
  category: "saas",
  title: "Open-source Shortcut alternative",
  description:
    "Kaneo is an open-source, self-hostable Shortcut alternative for software teams, free under the MIT license with SSO on every build.",
  summary: "The same lightness for software teams, free past ten people.",
  heading: "The open-source Shortcut alternative",
  subheading:
    "Shortcut is a good tracker for software teams, and it only runs on Shortcut's servers. Kaneo gives you the same shape of workflow on infrastructure you control.",
  verdict:
    "Kaneo is an open-source, MIT-licensed alternative to Shortcut. Both are built for software teams that want a board, a backlog, and not much ceremony. The difference is that Kaneo can be self-hosted for free with unlimited users, while Shortcut is cloud-only and free only up to 10 users.",
  facts: {
    license: "MIT, versus a proprietary licence for Shortcut",
    hosting: "Self-host anywhere, or EU-hosted cloud. Shortcut is cloud only",
    sso: "Free on every Kaneo build, Enterprise tier on Shortcut",
    pricing: "$0 self-hosted, cloud from $4 / month",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: false },
    { feature: "Own your data", kaneo: true, them: false },
    {
      feature: "Free tier",
      kaneo: "Unlimited, self-hosted",
      them: "Up to 10 users",
    },
    { feature: "SSO included", kaneo: "Free", them: "Enterprise" },
    {
      feature: "Git integration",
      kaneo: "GitHub, Gitea",
      them: "GitHub, GitLab",
    },
    { feature: "Time tracking", kaneo: true, them: false },
    {
      feature: "Cloud pricing",
      kaneo: "From $4/mo",
      them: "From $8.50/user/mo",
    },
  ],
  reasons: [
    {
      title: "The same lightness, without the lock-in",
      body: "Stories, states, and a board that stays out of the way. Kaneo keeps the workflow shape Shortcut users like and lets you host it yourself.",
    },
    {
      title: "Free past ten people",
      body: "Shortcut's free plan stops at 10 users. A self-hosted Kaneo instance has no seat count at all, so growth costs you nothing.",
    },
    {
      title: "Built-in time tracking",
      body: "Log time against tasks in Kaneo without a third-party integration. Shortcut leaves time tracking to external tools.",
    },
  ],
  honestNote:
    "Shortcut has a more developed product-team workflow than Kaneo: epics rolling up to milestones, iterations, and reporting that engineering managers actually use. If you need that reporting layer and are happy in the cloud, Shortcut is the stronger fit.",
  faq: [
    {
      question: "Can Shortcut be self-hosted?",
      answer:
        "No. Shortcut is cloud-only SaaS with no on-premise edition, so self-hosting means moving to an open-source tracker such as Kaneo, Plane, or Huly.",
    },
    {
      question: "What does Shortcut cost?",
      answer:
        "Shortcut is free for up to 10 users, then $8.50 per user a month for Team and $12 for Business, billed annually, with SSO on the Enterprise plan.",
    },
    {
      question: "Does Kaneo link tasks to Git commits and pull requests?",
      answer:
        "Yes. Kaneo has GitHub and Gitea integrations that connect repository activity to tasks, plus outgoing webhooks if you want to wire up something else.",
    },
    {
      question: "Does Kaneo have epics and iterations?",
      answer:
        "Kaneo has projects, a backlog, workflow columns, labels, priorities, and task relations, which cover most of what teams use epics for. It does not have Shortcut's iterations or milestone roll-up reporting.",
    },
  ],
  related: ["linear", "jira", "plane", "youtrack"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Shortcut pricing", href: "https://www.shortcut.com/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
