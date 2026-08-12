import type { Comparison } from "@/components/landing/comparison-page";

export const comparisons: Record<string, Comparison> = {
  jira: {
    competitor: "Jira",
    heading: "The open-source Jira alternative",
    subheading:
      "Jira can run a 500-person org, but most teams just want to plan and ship work without the weight. Kaneo is a simple, open-source project manager you can self-host or let us run for you.",
    rows: [
      { feature: "Open source (MIT)", kaneo: true, them: false },
      { feature: "Self-hostable", kaneo: true, them: "Data Center only" },
      { feature: "Own your data", kaneo: true, them: false },
      { feature: "Free to self-host", kaneo: true, them: false },
      { feature: "SSO included", kaneo: "Free", them: "Paid tier" },
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
  },
  trello: {
    competitor: "Trello",
    heading: "The self-hostable Trello alternative",
    subheading:
      "Trello nails simple kanban, but your boards live on someone else's servers and grow into paid Power-Ups. Kaneo keeps the simplicity, adds backlog and workflows, and lets you own the whole thing.",
    rows: [
      { feature: "Open source (MIT)", kaneo: true, them: false },
      { feature: "Self-hostable", kaneo: true, them: false },
      { feature: "Own your data", kaneo: true, them: false },
      { feature: "Kanban boards", kaneo: true, them: true },
      { feature: "Backlog & workflows", kaneo: true, them: "Power-Ups" },
      { feature: "Free to self-host", kaneo: true, them: false },
      { feature: "SSO included", kaneo: "Free", them: "Enterprise" },
      { feature: "Cloud pricing", kaneo: "From $4/mo", them: "Per user" },
    ],
    reasons: [
      {
        title: "Just as simple",
        body: "A clean board you can use in minutes, with no manual and no onboarding wizard. Kaneo keeps the thing people love about Trello.",
      },
      {
        title: "Room to grow",
        body: "Backlog planning, custom workflows, and roles are built in, so you don't hit a wall and start bolting on paid Power-Ups.",
      },
      {
        title: "Your boards, your servers",
        body: "Self-host under MIT for free, or use our managed cloud. Your data is exportable and never locked in.",
      },
    ],
    honestNote:
      "If you only need a couple of personal boards, never want to self-host, and Trello's free tier covers you, it's a perfectly good choice. Kaneo makes more sense the moment you care about owning your data or your team outgrows a simple board.",
  },
  linear: {
    competitor: "Linear",
    heading: "The open-source Linear alternative",
    subheading:
      "Linear is fast and beautifully focused, but it's closed-source, cloud-only, and you can't run it yourself. Kaneo gives you a clean, focused workflow that's open source and self-hostable.",
    rows: [
      { feature: "Open source (MIT)", kaneo: true, them: false },
      { feature: "Self-hostable", kaneo: true, them: false },
      { feature: "Own your data", kaneo: true, them: false },
      { feature: "Fast, focused UI", kaneo: true, them: true },
      { feature: "Free to self-host", kaneo: true, them: false },
      { feature: "SSO included", kaneo: "Free", them: "Paid plans" },
      { feature: "Cloud pricing", kaneo: "From $4/mo", them: "Per user" },
    ],
    reasons: [
      {
        title: "Clean and focused",
        body: "Kaneo is built around the same idea Linear popularized: a fast, uncluttered way to plan and execute, without the SaaS lock-in.",
      },
      {
        title: "Open and self-hostable",
        body: "Run Kaneo on your own infrastructure under the MIT license, keep your data in-house, and never depend on a vendor staying online.",
      },
      {
        title: "Honest pricing",
        body: "Free forever to self-host with every feature, including SSO. Managed cloud from $4/month, with no seats-gated features.",
      },
    ],
    honestNote:
      "Linear sets the bar for polish, speed, and deep product-team features like cycles and triage. If you're committed to cloud SaaS and want that specific, highly-refined workflow, it's excellent. Kaneo is for teams who want a clean experience they can actually own.",
  },
  planka: {
    competitor: "PLANKA",
    heading: "The PLANKA alternative with SSO included",
    subheading:
      "PLANKA 2.2 moved SSO into its paid Pro tier, and self-hosters who signed in with OIDC woke up to deactivated accounts. Kaneo is MIT-licensed, self-hostable, and ships SSO to everyone at no cost.",
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
  },
};
