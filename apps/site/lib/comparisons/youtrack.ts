import type { Comparison } from "./types";

export const youtrack: Comparison = {
  slug: "youtrack",
  competitor: "YouTrack",
  category: "saas",
  title: "YouTrack alternative: Kaneo vs YouTrack",
  description:
    "Kaneo is a YouTrack alternative with no ten-user ceiling and no annual server licence. Kaneo Cloud runs it for you from $4 a month, 14-day free trial.",
  summary: "No annual server licence and no ten-user ceiling.",
  heading: "The YouTrack alternative without the server licence",
  subheading:
    "YouTrack is free until your eleventh teammate, and self-hosting it means buying a JetBrains server licence. Kaneo Cloud runs Kaneo for you, and self-hosting it is free at any size.",
  verdict:
    "Kaneo is a YouTrack alternative for teams that have outgrown a ten-user free tier, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams. YouTrack is proprietary: free for up to 10 users in cloud and server form, then per-user cloud pricing or a paid annual server licence. Kaneo is also MIT-licensed open source, with no user cap when self-hosted.",
  facts: {
    license: "MIT, versus a proprietary JetBrains licence",
    hosting:
      "EU-hosted Kaneo Cloud, or self-host free. YouTrack Server needs a paid licence past the free tier",
    sso: "Free on every Kaneo build",
    pricing: "Cloud from $4 / month, or $0 self-hosted",
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
