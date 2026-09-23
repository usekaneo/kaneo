import type { Comparison } from "./types";

export const redmine: Comparison = {
  slug: "redmine",
  competitor: "Redmine",
  category: "open-source",
  title: "Modern Redmine alternative",
  description:
    "Kaneo is a modern, MIT-licensed Redmine alternative: the same self-hosted freedom with a current interface, SSO out of the box, and no plugin archaeology.",
  summary: "The same self-hosted freedom with an interface from this decade.",
  heading: "The modern Redmine alternative",
  subheading:
    "Redmine has been quietly running teams for two decades, and it looks it. Kaneo is the same idea, self-hosted and free, with an interface from this decade.",
  verdict:
    "Kaneo is a modern, MIT-licensed alternative to Redmine. Both are free and self-hostable, but Redmine is a Rails application from 2006 whose kanban boards, single sign-on, and modern conveniences generally come from third-party plugins. Kaneo ships boards, workflows, SSO, time tracking, and realtime updates as core features.",
  facts: {
    license: "MIT, versus GPLv2 for Redmine",
    hosting: "Both self-host. Kaneo is Docker plus PostgreSQL",
    sso: "Built in on Kaneo, LDAP or plugins on Redmine",
    pricing: "$0 self-hosted for both, Kaneo Cloud from $4 / month",
  },
  rows: [
    { feature: "License", kaneo: "MIT", them: "GPLv2" },
    { feature: "Self-hostable", kaneo: true, them: true },
    { feature: "Kanban board built in", kaneo: true, them: "Plugin" },
    {
      feature: "OIDC single sign-on",
      kaneo: "Built in",
      them: "Plugin or LDAP",
    },
    { feature: "Realtime updates", kaneo: true, them: false },
    { feature: "Time tracking", kaneo: true, them: true },
    { feature: "Official cloud", kaneo: true, them: false },
    { feature: "Interface", kaneo: "Current", them: "Dated" },
  ],
  reasons: [
    {
      title: "No plugin archaeology",
      body: "A usable Redmine often means a stack of community plugins, each pinned to a Redmine version. Kaneo's boards, workflows, and SSO are part of the product and upgrade with it.",
    },
    {
      title: "People will actually open it",
      body: "Redmine's interface is functional and unloved. Kaneo is a fast single-page app with realtime board updates, which matters when adoption is the hard part.",
    },
    {
      title: "A cloud option when you want one",
      body: "Redmine has no first-party hosting. Kaneo gives you the same MIT-licensed software either self-hosted or managed from $4 a month.",
    },
  ],
  honestNote:
    "Redmine is battle-tested, endlessly extensible, and still maintained, with an ecosystem covering almost anything through plugins. If you already run it, know its quirks, and depend on that ecosystem, there is no urgent reason to move. Kaneo is for teams starting fresh who want less to maintain.",
  faq: [
    {
      question: "Is Redmine still maintained?",
      answer:
        "Yes. Redmine is still actively developed and released under GPLv2, but its core interface and workflow model have changed little in years, and much of the modern functionality lives in third-party plugins.",
    },
    {
      question: "What is the best modern Redmine alternative?",
      answer:
        "Kaneo if you want something small, modern, and MIT licensed. OpenProject if you want a Redmine-descended platform with Gantt charts and enterprise support. Plane or Huly if you want a Linear-style interface.",
    },
    {
      question: "Does Kaneo support LDAP?",
      answer:
        "Kaneo authenticates through Google, GitHub, Discord, or any OIDC provider, which covers most directories through an identity provider such as Keycloak, Authentik, or Entra ID. There is no direct LDAP bind.",
    },
    {
      question: "Can I migrate Redmine issues to Kaneo?",
      answer:
        "There is no dedicated importer. Redmine has a REST API and Kaneo has a public API plus per-project JSON import, so a scripted migration is straightforward for someone comfortable with either API.",
    },
  ],
  related: ["openproject", "jira", "kanboard", "taiga"],
  verifiedOn: "2026-08-19",
  sources: [
    { label: "Redmine", href: "https://www.redmine.org/" },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
