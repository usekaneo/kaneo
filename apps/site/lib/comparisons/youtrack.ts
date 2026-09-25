import type { Comparison } from "./types";

export const youtrack: Comparison = {
  slug: "youtrack",
  competitor: "YouTrack",
  category: "saas",
  title: "Open-source YouTrack alternative",
  description:
    "Kaneo is an open-source, MIT-licensed YouTrack alternative you can self-host for free with no user cap and no annual server licence.",
  summary: "No annual server licence and no ten-user ceiling.",
  heading: "The open-source YouTrack alternative",
  subheading:
    "YouTrack is free until your eleventh teammate, and self-hosting it means buying a JetBrains server licence. Kaneo is MIT licensed, so running it yourself is free at any size.",
  verdict:
    "Kaneo is an open-source alternative to JetBrains YouTrack. YouTrack is proprietary: free for up to 10 users in cloud and server form, then per-user cloud pricing or a paid annual server licence. Kaneo is MIT licensed with no user cap when self-hosted, and its cloud starts at $4 a month.",
  facts: {
    license: "MIT, versus a proprietary JetBrains licence",
    hosting:
      "Self-host free. YouTrack Server needs a paid licence past the free tier",
    sso: "Free on every Kaneo build",
    pricing: "$0 self-hosted, cloud from $4 / month",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    {
      feature: "Self-hostable",
      kaneo: "Free, unlimited",
      them: "Paid licence",
    },
    { feature: "Own your data", kaneo: true, them: true },
    {
      feature: "Free tier",
      kaneo: "Unlimited, self-hosted",
      them: "Up to 10 users",
    },
    { feature: "Query language", kaneo: "Search & filters", them: "Advanced" },
    { feature: "Workflow scripting", kaneo: "Rules", them: "JavaScript" },
    { feature: "Learning curve", kaneo: "Minutes", them: "Moderate" },
    {
      feature: "Cloud pricing",
      kaneo: "From $4/mo",
      them: "From $4.50/user/mo",
    },
  ],
  reasons: [
    {
      title: "No licence to renew",
      body: "Self-hosted Kaneo is MIT licensed with no seat count, no annual renewal, and no licence server. You run the container and that is the arrangement.",
    },
    {
      title: "Simpler by design",
      body: "YouTrack is deep: custom fields, a query language, and JavaScript workflows. Kaneo's boards, backlog, and workflow rules are meant to be understood in an afternoon.",
    },
    {
      title: "Everything in every build",
      body: "SSO, roles, time tracking, integrations, API keys, and MCP access come with Kaneo wherever you run it.",
    },
  ],
  honestNote:
    "YouTrack is a serious issue tracker with an excellent query language, powerful workflow scripting, and tight integration with the rest of the JetBrains toolchain. If your team already lives in JetBrains IDEs and you want that depth, Kaneo will feel small next to it.",
  faq: [
    {
      question: "Is YouTrack open source?",
      answer:
        "No. YouTrack is proprietary JetBrains software. It has a free tier for up to 10 users in both cloud and server editions, but the source is not published and larger deployments need a paid licence.",
    },
    {
      question: "What does YouTrack cost after the free tier?",
      answer:
        "YouTrack Cloud is priced per user for teams of 11 or more, starting around $4.50 per user a month billed annually. YouTrack Server is sold as an annual licence, starting at roughly $600 a year.",
    },
    {
      question: "What is the best open-source YouTrack alternative?",
      answer:
        "Kaneo if you want something light and MIT licensed, Redmine if you want a mature tracker with a large plugin ecosystem, or Plane if you want a Linear-style interface under AGPL.",
    },
    {
      question: "Does Kaneo have a query language?",
      answer:
        "No. Kaneo has search plus filters on boards and the backlog, which covers day-to-day use. It has no equivalent to YouTrack's saved queries and issue-query syntax.",
    },
  ],
  related: ["jira", "redmine", "linear", "shortcut"],
  verifiedOn: "2026-08-19",
  sources: [
    {
      label: "YouTrack pricing",
      href: "https://www.jetbrains.com/youtrack/buy/",
    },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
