import type { Guide } from "./types";

export const openSourceJiraAlternatives: Guide = {
  slug: "open-source-jira-alternatives",
  question: "What are the best open-source Jira alternatives?",
  title: "Open-source Jira alternatives worth using in 2026",
  description:
    "The open-source, self-hostable tools that actually replace Jira for a small or mid-sized team, what each one gives up, and how to move your issues across.",
  summary:
    "Five self-hostable trackers that replace Jira, and the Jira features none of them have.",
  answer:
    "The realistic open-source Jira alternatives are Kaneo, Plane, OpenProject, Redmine, and Taiga. Kaneo is the lightest and is MIT licensed with single sign-on included, Plane is closest in interface to a modern tracker, OpenProject is closest to Jira in scope, Redmine has the deepest plugin ecosystem, and Taiga is the strongest for Scrum. None of them replicate Jira's schemes, marketplace, or Jira Service Management.",
  sections: [
    {
      heading: "Why teams leave Jira",
      body: [
        "Rarely because a feature is missing. Usually because of the weight: permission schemes, issue-type schemes, screen schemes, and a workflow editor that needs an owner. Jira is built so a 500-person organisation can encode its process, and that same machinery is overhead for a team of eight.",
        "The second reason is hosting. Atlassian ended new Jira Server sales, so running Jira on your own hardware means Jira Data Center, priced by user tier as an annual subscription. For teams whose reason for self-hosting is cost or data control, that is the wrong end of the deal.",
        "The third is pricing shape. Jira Cloud is free up to 10 users, then per user, with SAML single sign-on needing an Atlassian Guard subscription or the Enterprise tier. Small teams cross that line quickly.",
      ],
    },
    {
      heading: "The alternatives, and who each is for",
      items: [
        {
          name: "Kaneo",
          meta: "MIT, self-hosted free",
          href: "/jira-alternative",
          body: "For teams who want the board, backlog, workflows, roles, and time tracking and nothing else. One container plus PostgreSQL, SSO through any OIDC provider in the free build, a documented public API, and an MCP server. No Gantt charts, no schemes, no marketplace.",
        },
        {
          name: "Plane",
          meta: "AGPL-3.0 Community edition",
          href: "/plane-alternative",
          body: "For teams who want a Linear-shaped product they can host. Cycles, modules, and intake, with a larger self-hosted stack and SSO on the paid tiers.",
        },
        {
          name: "OpenProject",
          meta: "GPLv3 Community, Enterprise add-on",
          href: "/openproject-alternative",
          body: "For organisations that actually used Jira's structure: work-package hierarchies, Gantt charts, baselines, budgets, and cost reporting, with commercial support available. Single sign-on is an Enterprise feature.",
        },
        {
          name: "Redmine",
          meta: "GPLv2",
          href: "/redmine-alternative",
          body: "For teams who want a mature tracker and are comfortable assembling plugins. Anything Jira does, some Redmine plugin approximates. The interface is dated and OIDC login is a plugin.",
        },
        {
          name: "Taiga",
          meta: "MPL-2.0",
          href: "/taiga-alternative",
          body: "For teams running Scrum properly: sprints, story points, burndowns, and epics, free to self-host.",
        },
      ],
    },
    {
      heading: "What you give up",
      body: [
        "Jira Service Management has no real open-source equivalent in this list. If your team runs a customer-facing service desk with SLAs, keep it or look at a dedicated help-desk tool.",
        "The Atlassian Marketplace is the other genuine loss. Time-tracking add-ons, test management, capacity planning, and compliance tooling are usually a plugin away in Jira and a project of their own elsewhere.",
        "Advanced permission and workflow schemes go too. Most teams that leave Jira consider this a feature of leaving, but if you have compliance requirements encoded in Jira workflows, check the alternative can express them before you commit.",
      ],
    },
    {
      heading: "Moving your issues",
      body: [
        "Jira exports issues to CSV and has a well-documented REST API, so a scripted migration is realistic for anything up to a few thousand issues. The parts that hurt are attachments, comment history with author attribution, and issue links.",
        "Do a dry run into a scratch project first, check that assignees resolve by email address, and keep the Jira instance readable for a quarter rather than cancelling it the same week. Kaneo has a public API and per-project JSON import, and we are happy to help with a migration script if you open an issue on GitHub.",
      ],
    },
  ],
  faq: [
    {
      question: "Is there a free version of Jira?",
      answer:
        "Jira Cloud has a free tier for up to 10 users with limits on storage and automation. Beyond that it is priced per user, and SAML single sign-on needs an Atlassian Guard subscription or the Enterprise tier. Self-hosting means Jira Data Center, which is a paid annual subscription.",
    },
    {
      question: "Can Jira be self-hosted for free?",
      answer:
        "No. Jira Server is discontinued for new customers and Data Center is a paid subscription sized by user tier. If free self-hosting is the requirement, you need an open-source tracker.",
    },
    {
      question: "What is the closest open-source tool to Jira?",
      answer:
        "OpenProject, in scope and structure. If what you liked about Jira was the board and backlog rather than the schemes and reports, Kaneo or Plane will feel closer to what you actually used.",
    },
    {
      question: "How long does a Jira migration take?",
      answer:
        "For a small team with a handful of projects, a day of scripting and a weekend of parallel running. The variables are attachment volume, comment history, and how many custom fields you decide to carry across rather than drop.",
    },
  ],
  related: [
    { label: "Kaneo vs Jira", href: "/jira-alternative" },
    {
      label: "Best open-source project management software",
      href: "/guides/best-open-source-project-management-software",
    },
    { label: "All comparisons", href: "/alternatives" },
  ],
  updatedOn: "2026-08-19",
};
