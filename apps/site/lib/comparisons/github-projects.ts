import type { Comparison } from "./types";

export const githubProjects: Comparison = {
  slug: "github-projects",
  competitor: "GitHub Projects",
  category: "saas",
  title: "Standalone GitHub Projects alternative",
  description:
    "Kaneo is a standalone GitHub Projects alternative with time tracking and roles, for work beyond your repos. Kaneo Cloud runs it for you from $4 a month.",
  summary: "A tracker for the work that does not belong in a repository.",
  heading: "The standalone alternative to GitHub Projects",
  subheading:
    "GitHub Projects is free and fine, right up until you need non-engineering work, time tracking, or a tracker that outlives your GitHub plan. Kaneo is a standalone board you own.",
  verdict:
    "Kaneo is a GitHub Projects alternative for teams whose work does not all live in GitHub issues, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams. GitHub Projects is included with GitHub and excellent for repository-bound work, but it has no time tracking, no workspace roles outside GitHub's own, and it ties your planning history to your GitHub account. Kaneo is also MIT-licensed open source, so you can self-host it for free any time.",
  facts: {
    license: "MIT, and independent of any repository host",
    hosting: "EU-hosted Kaneo Cloud, or self-host anywhere",
    sso: "Any OIDC provider on every Kaneo build, SAML on GitHub Enterprise",
    pricing: "Cloud from $4 / month, or $0 self-hosted",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: "Enterprise Server" },
    { feature: "Works without GitHub", kaneo: true, them: false },
    { feature: "Non-code work", kaneo: true, them: "Awkward" },
    { feature: "Time tracking", kaneo: true, them: false },
    { feature: "Workspace roles", kaneo: true, them: "GitHub org roles" },
    { feature: "GitHub integration", kaneo: true, them: "Native" },
    {
      feature: "Pricing",
      kaneo: "Free self-hosted",
      them: "Included with GitHub",
    },
  ],
  reasons: [
    {
      title: "Not everything is an issue",
      body: "Design, ops, onboarding, and client work rarely belong in a repository. Kaneo gives that work a home without opening placeholder issues for it.",
    },
    {
      title: "Time tracking built in",
      body: "Log time against any task in Kaneo. GitHub Projects has no time tracking, so teams end up bolting on a second tool.",
    },
    {
      title: "Your planning survives a migration",
      body: "If you ever move off GitHub, your Kaneo board comes with you. It is MIT licensed, self-hostable, and exports to JSON.",
    },
  ],
  honestNote:
    "For a team whose work is entirely code in GitHub repositories, GitHub Projects is hard to argue with: it is included in your plan, it lives next to the pull requests, and the automation between issues and boards is genuinely good. Kaneo makes sense when planning has outgrown the repository.",
  faq: [
    {
      question: "Is GitHub Projects free?",
      answer:
        "Yes, Projects is included with GitHub, including the Free plan. GitHub's paid plans are $4 per user a month for Team and from $21 for Enterprise, which is where SAML SSO and advanced auditing appear.",
    },
    {
      question: "Can I use GitHub Projects for non-engineering work?",
      answer:
        "You can, but every item is a repository issue or a draft item, so non-code work either clutters a repo or lives as drafts with fewer features. A standalone tracker avoids that trade.",
    },
    {
      question: "Does Kaneo integrate with GitHub?",
      answer:
        "Yes. Kaneo has GitHub, GitLab, and Gitea integrations connecting repository activity to tasks, plus outgoing webhooks, a public API, and an MCP server if you want AI agents to work with your board.",
    },
    {
      question: "Can GitHub Projects be self-hosted?",
      answer:
        "Only as part of GitHub Enterprise Server, which is a licensed on-premise install of GitHub itself. Kaneo self-hosts on its own with Docker and PostgreSQL, free under the MIT license.",
    },
  ],
  related: ["jira", "linear", "azure-devops", "shortcut"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "GitHub pricing", href: "https://github.com/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
