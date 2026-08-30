import type { Comparison } from "./types";

export const focalboard: Comparison = {
  slug: "focalboard",
  competitor: "Focalboard",
  category: "open-source",
  title: "Maintained Focalboard alternative",
  description:
    "Kaneo is an actively maintained, MIT-licensed Focalboard alternative for teams that need a self-hosted board with a future.",
  summary: "An actively maintained board, independent of Mattermost.",
  heading: "The maintained Focalboard alternative",
  subheading:
    "Standalone Focalboard has been looking for maintainers since Mattermost unbundled it. If you are self-hosting it today, you are running software nobody is on the hook for.",
  verdict:
    "Kaneo is an actively maintained, MIT-licensed alternative to Focalboard. Mattermost stopped bundling the Focalboard plugin in 2023 and the standalone project moved to community maintenance, with the plugin continuing separately as Mattermost Boards. Kaneo offers a comparable self-hosted board with regular releases, SSO, and a documented API.",
  facts: {
    license: "MIT, versus Focalboard's mixed Mattermost licensing",
    hosting: "Both self-host. Kaneo is Docker plus PostgreSQL",
    sso: "Free on Kaneo through Google, GitHub, Discord, or any OIDC provider",
    pricing: "$0 self-hosted, cloud from $4 / month",
  },
  rows: [
    {
      feature: "Actively maintained",
      kaneo: true,
      them: "Community, seeking maintainers",
    },
    { feature: "License", kaneo: "MIT", them: "Mixed Mattermost licensing" },
    { feature: "Self-hostable", kaneo: true, them: true },
    {
      feature: "Runs without Mattermost",
      kaneo: true,
      them: "Standalone build only",
    },
    { feature: "SSO / OIDC", kaneo: "Built in", them: "Via Mattermost" },
    { feature: "Backlog planning", kaneo: true, them: false },
    { feature: "Time tracking", kaneo: true, them: false },
    { feature: "Official cloud", kaneo: true, them: false },
  ],
  reasons: [
    {
      title: "Somebody is maintaining it",
      body: "Kaneo ships releases, security fixes, and migrations that work on existing installations. That is the whole argument here: a self-hosted board is only as good as its next update.",
    },
    {
      title: "Independent of a chat platform",
      body: "Focalboard's future is as a Mattermost plugin. Kaneo is a standalone product, and it integrates with Slack, Discord, and Telegram rather than living inside one of them.",
    },
    {
      title: "More than a board",
      body: "Backlog planning, workflow rules, roles, time tracking, notifications, an API, and an MCP server, all in the MIT-licensed build.",
    },
  ],
  honestNote:
    "If you already run Mattermost, the maintained Boards plugin keeps your tasks next to your conversations, and that adjacency is worth a lot. Focalboard's card and property model is also flexible in a Notion-like way that Kaneo deliberately does not copy.",
  faq: [
    {
      question: "Is Focalboard discontinued?",
      answer:
        "The standalone Focalboard project is no longer actively maintained by Mattermost and is looking for community maintainers. Mattermost stopped bundling the plugin in September 2023, and the plugin now continues separately as Mattermost Boards.",
    },
    {
      question: "What should I use instead of Focalboard?",
      answer:
        "For a maintained self-hosted board, Kaneo, PLANKA, WeKan, and Vikunja are the usual choices. Kaneo is MIT licensed with SSO included and adds backlog planning and time tracking.",
    },
    {
      question: "Can I move my Focalboard data to Kaneo?",
      answer:
        "There is no dedicated importer. Focalboard exports boards as archive files, and Kaneo has a public API and per-project JSON import, so a scripted migration is possible. Open a GitHub issue if you want this supported properly.",
    },
    {
      question: "Does Kaneo need Mattermost or another chat tool?",
      answer:
        "No. Kaneo is standalone. It can post notifications into Slack, Discord, or Telegram, but nothing requires them.",
    },
  ],
  related: ["planka", "wekan", "trello", "notion"],
  verifiedOn: "2026-08-19",
  sources: [
    {
      label: "Focalboard repository",
      href: "https://github.com/mattermost-community/focalboard",
    },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
