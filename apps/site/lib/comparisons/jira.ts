import type { Comparison } from "./types";

export const jira: Comparison = {
  slug: "jira",
  competitor: "Jira",
  category: "saas",
  title: "Open-source Jira alternative",
  description:
    "Kaneo is an open-source, self-hostable project management tool and a simple Jira alternative you can run yourself or use as a managed cloud. Free to self-host, fair cloud pricing.",
  summary:
    "Same planning, none of the admin console. MIT licensed and free to self-host.",
  heading: "The open-source Jira alternative",
  subheading:
    "Jira can run a 500-person org, but most teams just want to plan and ship work without the weight. Kaneo is a simple, open-source project manager you can self-host or let us run for you.",
  verdict:
    "Kaneo is an open-source Jira alternative under the MIT license. You can self-host it for free with Docker and PostgreSQL, with every feature included, or use Kaneo Cloud from $4 a month. It covers boards, backlog, workflows, roles, time tracking, and a public API, and it deliberately leaves out the configuration layer that makes Jira heavy.",
  facts: {
    license: "MIT, versus a proprietary licence for Jira",
    hosting: "Self-host anywhere, or EU-hosted cloud",
    sso: "Free on every Kaneo build. Jira needs Atlassian Guard or Enterprise",
    pricing: "$0 self-hosted, cloud from $4 / month",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: "Data Center only" },
    { feature: "Own your data", kaneo: true, them: false },
    { feature: "Free to self-host", kaneo: true, them: false },
    { feature: "SSO included", kaneo: "Free", them: "Guard or Enterprise" },
    { feature: "Setup", kaneo: "Minutes", them: "Involved" },
    { feature: "Learning curve", kaneo: "Minutes", them: "Steep" },
    {
      feature: "Cloud pricing",
      kaneo: "From $4/mo",
      them: "Per user, higher",
    },
  ],
  reasons: [
    {
      title: "No bloat",
      body: "Boards, backlog, and workflows that work out of the box. No admin console to configure for a week before you can create a task.",
    },
    {
      title: "Own your data",
      body: "Self-host Kaneo on your own servers under the MIT license, or use our EU-hosted cloud. Either way you can export everything, anytime.",
    },
    {
      title: "Fair, honest pricing",
      body: "Free forever to self-host, including SSO. Managed cloud starts at $4/month with no per-feature paywalls.",
    },
  ],
  honestNote:
    "If you're a large organization that needs deep enterprise workflows, advanced permission schemes, and a big marketplace of add-ons, and you have the time to configure it, Jira is built for exactly that. Kaneo is for teams who want to manage work, not administer a tool.",
  faq: [
    {
      question: "Is there a free and open-source alternative to Jira?",
      answer:
        "Yes. Kaneo is MIT licensed and free to self-host with no user limits, and there are others worth knowing about, including Redmine, OpenProject, Taiga, and Plane. Kaneo is the closest match if you want something small and fast rather than something you configure.",
    },
    {
      question: "Can I self-host Jira?",
      answer:
        "Only through Jira Data Center, which is sold as an annual subscription sized by user tier. Atlassian ended new Jira Server licence sales, so a small team that wants an on-premise tracker generally has to pay Data Center pricing or move to a different tool.",
    },
    {
      question: "Does Kaneo have Jira features like sprints and workflows?",
      answer:
        "Kaneo has backlog planning, configurable workflow columns per project, labels, priorities, assignees, task relations, comments, time tracking, and workspace roles. It does not have Jira's schemes, custom issue-type hierarchies, or marketplace apps, which is the deliberate trade.",
    },
    {
      question: "How much does Kaneo cost compared to Jira?",
      answer:
        "Self-hosting Kaneo costs nothing beyond your server. Kaneo Cloud is $4 a month for a single user and $5 per user a month for teams. Jira Cloud is free for up to 10 users and then charged per user, with SAML single sign-on requiring an Atlassian Guard subscription or the Enterprise tier that includes it.",
    },
  ],
  related: ["linear", "asana", "clickup", "openproject"],
  verifiedOn: "2026-08-19",
  sources: [
    {
      label: "Jira pricing",
      href: "https://www.atlassian.com/software/jira/pricing",
    },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
