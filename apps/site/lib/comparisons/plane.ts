import type { Comparison } from "./types";

export const plane: Comparison = {
  slug: "plane",
  competitor: "Plane",
  category: "open-source",
  title: "Lighter Plane alternative",
  description:
    "Kaneo is a lighter Plane alternative with one edition and no features held back. Kaneo Cloud runs it for you from $4 a month, with nothing to maintain.",
  summary:
    "One edition with nothing held back, and nothing to maintain on Kaneo Cloud.",
  heading: "The lighter Plane alternative",
  subheading:
    "Plane is a capable open-source tracker with a Community edition and a Commercial edition above it. Kaneo has one edition with every feature, Kaneo Cloud runs it for you, and it is a much smaller install if you self-host.",
  verdict:
    "Kaneo is a lighter Plane alternative for teams that want one edition with every feature, and Kaneo Cloud runs it for you from $4 a month, or $5 per user for teams, with nothing to maintain. Plane's Community edition is AGPL-3.0 and free, with a separate Commercial edition and paid cloud tiers where single sign-on and advanced controls live, while Kaneo has a single edition and runs as one container plus PostgreSQL. Kaneo is also MIT licensed, so you can self-host it for free with single sign-on included.",
  facts: {
    license: "MIT, versus AGPL-3.0 for the Plane Community edition",
    hosting:
      "EU-hosted Kaneo Cloud. Both self-host, Kaneo as a single container plus PostgreSQL",
    sso: "Free on every Kaneo build, Pro tier and above on Plane",
    pricing: "Cloud from $4 / month, or $0 self-hosted",
  },
  rows: [
    { feature: "License", kaneo: "MIT", them: "AGPL-3.0 (Community)" },
    { feature: "Self-hostable", kaneo: true, them: true },
    { feature: "Separate commercial edition", kaneo: false, them: true },
    { feature: "SSO in free build", kaneo: true, them: false },
    {
      feature: "Install footprint",
      kaneo: "One container + Postgres",
      them: "Multi-service",
    },
    { feature: "Cycles & modules", kaneo: false, them: true },
    { feature: "Time tracking", kaneo: true, them: "Paid tiers" },
    { feature: "Cloud pricing", kaneo: "From $4/mo", them: "From $6/seat/mo" },
  ],
  reasons: [
    {
      title: "One edition, no upgrade path to buy",
      body: "Plane splits into Community, Commercial, and Airgapped editions. Kaneo has one build, and everything in it is yours under MIT.",
    },
    {
      title: "Less to operate",
      body: "Kaneo is a container and a database. Plane's self-hosted stack has more services to run, monitor, and upgrade.",
    },
    {
      title: "Permissive licensing",
      body: "MIT rather than AGPL matters if you intend to modify Kaneo and offer it as part of a service. It removes the question entirely.",
    },
  ],
  migration: {
    body: "Kaneo imports projects from Plane Cloud or a self-hosted Plane from the app: states, work items with their keys, priorities, dates, labels, comments, and sub-issues. Plane is only read, never changed.",
    href: "https://kaneo.app/docs/core/migrations/from-plane",
    linkText: "Read the import guide",
  },
  honestNote:
    "Plane is the more feature-complete tracker: cycles, modules, intake, pages, and a polished interface, backed by a well-funded team shipping quickly. If you want a Linear-shaped open-source product and do not mind AGPL or a bigger install, Plane is an excellent choice.",
  faq: [
    {
      question: "Is Plane fully open source?",
      answer:
        "The Community edition is open source under AGPL-3.0 and free to self-host with no user limits. Plane also sells Commercial and Airgapped editions, and its cloud plans put single sign-on and advanced controls on paid tiers.",
    },
    {
      question: "Plane or Kaneo for a self-hosted team?",
      answer:
        "Plane if you want cycles, modules, and a broader feature set and can run a larger stack. Kaneo if you want MIT licensing, SSO in the free build, and the smallest install that still handles a team.",
    },
    {
      question: "Does AGPL matter for self-hosting?",
      answer:
        "For internal use, generally not. It matters if you modify the code and offer it to others over a network, where AGPL requires you to publish your changes. MIT has no such requirement.",
    },
    {
      question: "Can I migrate from Plane to Kaneo?",
      answer:
        "Yes. Kaneo imports projects from Plane Cloud or a self-hosted Plane from the app with a Plane personal access token. States, work items with their keys, priorities, dates, labels, comments, and sub-issues carry over. Cycles, modules, and attachments do not.",
    },
  ],
  related: ["linear", "huly", "jira", "openproject"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Plane pricing", href: "https://plane.so/pricing" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
