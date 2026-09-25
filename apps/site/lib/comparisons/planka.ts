import type { Comparison } from "./types";

export const planka: Comparison = {
  slug: "planka",
  competitor: "PLANKA",
  category: "open-source",
  title: "PLANKA alternative with SSO included",
  description:
    "Kaneo is an MIT-licensed PLANKA alternative with SSO on every self-hosted build, built-in export, and an importer that moves your PLANKA boards over.",
  summary: "MIT licensed, with OIDC single sign-on free and a PLANKA importer.",
  heading: "The PLANKA alternative with SSO included",
  subheading:
    "PLANKA 2.2 moved SSO into its paid Pro tier, and self-hosters who signed in with OIDC woke up to deactivated accounts. Kaneo is MIT-licensed, self-hostable, and ships SSO to everyone at no cost.",
  verdict:
    "Kaneo is an MIT-licensed alternative to PLANKA that keeps OIDC single sign-on free on the self-hosted build. It has an importer that reads boards, lists, cards, labels, assignees, checklists, and comments straight from the PLANKA API, since PLANKA has no export of its own.",
  facts: {
    license: "MIT, versus PLANKA's source-available Fair Use licence",
    hosting: "Both self-host. Kaneo also offers an EU-hosted cloud",
    sso: "Free on Kaneo, Pro tier on PLANKA since 2.2",
    pricing: "$0 self-hosted, cloud from $4 / month",
  },
  rows: [
    { feature: "License", kaneo: "MIT", them: "Fair Use (source-available)" },
    { feature: "Self-hostable", kaneo: true, them: true },
    { feature: "Own your data", kaneo: true, them: true },
    { feature: "Kanban boards", kaneo: true, them: true },
    { feature: "SSO / OIDC", kaneo: "Free", them: "Pro only" },
    { feature: "Backlog & workflows", kaneo: true, them: false },
    { feature: "Data export", kaneo: "Built in", them: false },
    { feature: "Cloud pricing", kaneo: "From $4/mo", them: "Per user" },
  ],
  reasons: [
    {
      title: "SSO is not a premium feature",
      body: "Connect Google, GitHub, Discord, or any OIDC provider on the free, self-hosted build. We think authentication is part of running software safely, not an upsell, and we don't plan to move it.",
    },
    {
      title: "Genuinely MIT",
      body: "Kaneo is MIT end to end, with no Pro-only files carved out of the repository. You can fork it, run it, and change it without checking which licence a given file falls under.",
    },
    {
      title: "Your data stays portable",
      body: "Every project exports to JSON from the UI, and the whole API is public and documented. Getting out of Kaneo is as easy as getting in, which is rather the point.",
    },
  ],
  migration: {
    body: "PLANKA has no export feature, so we wrote an importer that reads your boards straight from its API and recreates them in Kaneo: lists, cards, labels, assignees, checklists, and comments. Start with a dry run, which writes nothing.",
    href: "https://kaneo.app/docs/core/migrations/from-planka",
    linkText: "Read the migration guide",
  },
  honestNote:
    "PLANKA is a good piece of software with a real team behind it, and paid tiers are a legitimate way to fund open-source work. If you're happy on the Community edition with password logins, or SSO is worth the Pro licence to you, there's no reason to move. Kaneo is for teams that need SSO and don't want it behind a paywall.",
  faq: [
    {
      question: "Why did PLANKA move SSO behind a paid tier?",
      answer:
        "PLANKA 2.2 reorganised its editions and put OIDC single sign-on in the paid Pro tier. Self-hosters who had been signing in with OIDC found those accounts deactivated after upgrading. It is a legitimate way to fund the project, but it changes what the free build can do.",
    },
    {
      question: "How do I migrate from PLANKA to Kaneo?",
      answer:
        "Use the @kaneo/planka-import package. It reads boards from the PLANKA API with an API key and recreates them in Kaneo, including lists, cards, labels, assignees, checklists, and comments. Run it in dry-run mode first, which writes nothing.",
    },
    {
      question: "Is Kaneo's licence really MIT?",
      answer:
        "Yes, the whole repository is MIT with no source-available carve-outs and no separate enterprise directory. You can fork it, modify it, and run it commercially without checking which licence covers a given file.",
    },
    {
      question: "Does Kaneo have PLANKA's card features?",
      answer:
        "Kaneo has boards, lists as workflow columns, labels, assignees, due dates, priorities, comments, attachments, task relations, and time tracking, plus backlog planning that PLANKA does not have. Some PLANKA card details, such as its stopwatch UI, work differently.",
    },
  ],
  related: ["trello", "wekan", "kanboard", "vikunja"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "PLANKA pricing", href: "https://planka.app/pricing" },
    {
      label: "Kaneo migration guide",
      href: "/docs/core/migrations/from-planka",
    },
  ],
};
