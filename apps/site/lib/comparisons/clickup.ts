import type { Comparison } from "./types";

export const clickup: Comparison = {
  slug: "clickup",
  competitor: "ClickUp",
  category: "saas",
  title: "Open-source ClickUp alternative",
  description:
    "Kaneo is an open-source, self-hostable ClickUp alternative. All the planning you need, none of the feature sprawl, free to run yourself under the MIT license.",
  summary:
    "The planning part, without the docs, whiteboards, and chat you turn off anyway.",
  heading: "The open-source ClickUp alternative",
  subheading:
    "ClickUp's pitch is that it does everything. That is also the complaint. Kaneo does the part your team actually opens every morning, and you can run it on your own server.",
  verdict:
    "Kaneo is an open-source, MIT-licensed alternative to ClickUp that you can self-host for free with unlimited users. ClickUp is cloud-only, with paid tiers from $7 per user a month and SAML single sign-on on its higher tiers. Kaneo covers boards, backlog, workflows, labels, roles, and time tracking, and stops there on purpose.",
  facts: {
    license: "MIT, versus a proprietary licence for ClickUp",
    hosting: "Self-host anywhere, or EU-hosted cloud. ClickUp is cloud only",
    sso: "Free on every Kaneo build, Business tier and above on ClickUp",
    pricing: "$0 self-hosted, cloud from $4 / month",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: true, them: false },
    { feature: "Own your data", kaneo: true, them: false },
    { feature: "Free tier storage", kaneo: "Your bucket", them: "60MB" },
    { feature: "SSO included", kaneo: "Free", them: "Business and up" },
    { feature: "Time tracking", kaneo: true, them: true },
    { feature: "Feature surface", kaneo: "Focused", them: "Very broad" },
    { feature: "Cloud pricing", kaneo: "From $4/mo", them: "From $7/user/mo" },
  ],
  reasons: [
    {
      title: "Fewer things to turn off",
      body: "ClickUp ships docs, whiteboards, chat, goals, and forms, and most teams spend their first week disabling them. Kaneo has one job and does not ask you to configure it.",
    },
    {
      title: "Storage on your terms",
      body: "ClickUp's free plan caps attachments at 60MB. Self-hosted Kaneo keeps attachments in S3-compatible storage you control, including MinIO on your own hardware, so the limit is whatever you provision.",
    },
    {
      title: "One product, one price",
      body: "Self-hosted Kaneo includes everything, SSO included. There is no Business tier to reach before your team can sign in with Google.",
    },
  ],
  honestNote:
    "ClickUp is remarkably capable if you genuinely want one tool for docs, whiteboards, chat, dashboards, and tasks, and you have someone willing to set it up properly. Kaneo will feel bare next to it. That is the trade being offered.",
  faq: [
    {
      question: "Is there a self-hosted alternative to ClickUp?",
      answer:
        "Yes. Kaneo, Plane, OpenProject, Vikunja, and Taiga can all be self-hosted. Kaneo is MIT licensed and runs as a single container with PostgreSQL, which makes it one of the simplest to keep online.",
    },
    {
      question: "Can ClickUp be self-hosted?",
      answer:
        "No. ClickUp is a cloud-only SaaS product. Enterprise customers get extra security controls, but there is no installable edition.",
    },
    {
      question: "What is ClickUp's free plan limited to?",
      answer:
        "The Free Forever plan has unlimited tasks and members but caps storage at 60MB and limits several features by usage. Paid tiers are $7 per user a month for Unlimited and $12 for Business, billed annually, with Google SSO on Business and custom SAML at the Enterprise level.",
    },
    {
      question: "Does Kaneo replace ClickUp Docs and Whiteboards?",
      answer:
        "No. Kaneo has task descriptions, comments, and attachments, but no document editor, whiteboard, or chat. If those are the reason you use ClickUp, Kaneo is not a like-for-like swap.",
    },
  ],
  related: ["asana", "monday", "notion", "plane"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "ClickUp pricing", href: "https://clickup.com/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
