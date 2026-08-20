import type { Guide } from "./types";

export const euHostedProjectManagementGdpr: Guide = {
  slug: "eu-hosted-project-management-gdpr",
  question: "Which project management tools keep data in the EU?",
  title: "EU-hosted and GDPR-friendly project management tools",
  description:
    "How to keep project data inside the EU: self-hosting, EU-hosted cloud options, and what data residency does and does not solve under GDPR.",
  summary:
    "Self-hosting, EU regions, and what data residency actually gets you under GDPR.",
  answer:
    "There are two reliable ways to keep project data in the EU: self-host an open-source tool on EU infrastructure, or use a provider whose servers are in the EU. Kaneo covers both, since the self-hosted build runs wherever you put it and Kaneo Cloud is hosted in the EU. Most large SaaS vendors offer EU data residency only on higher tiers, and residency alone does not settle the question of transfers to a parent company outside the EU.",
  sections: [
    {
      heading: "Self-hosting is the simple answer",
      body: [
        "If the software runs on a server you rent in Frankfurt, Amsterdam, or Helsinki, there is no transfer to assess and no processor agreement to negotiate for the tool itself. You are the controller and the infrastructure provider is your processor, which is a much shorter conversation with a data protection officer.",
        "The open-source tools that make this straightforward are Kaneo, Plane, OpenProject, Redmine, Taiga, Vikunja, WeKan, and Kanboard. Kaneo is MIT licensed and runs as one container plus PostgreSQL, with attachments in S3-compatible storage you choose, so every byte stays where you put it.",
      ],
    },
    {
      heading: "If you would rather not run it",
      body: [
        "Kaneo Cloud is hosted in the EU and runs the same MIT-licensed software as the self-hosted build, which means the exit path is real: export your projects to JSON, or stand up your own instance and move.",
        "Among the larger vendors, EU data residency is usually available but tied to plan level or to an enterprise agreement. Check three things: where the primary data is stored, where backups are stored, and where support staff access it from. The third one is the one people forget.",
      ],
    },
    {
      heading: "What data residency does not solve",
      body: [
        "Residency is about location, not about lawful basis. You still need a processor agreement, a retention policy, and a way to answer a subject access or deletion request. A project tracker holds names, email addresses, comments, and sometimes client information, all of which is personal data.",
        "Practical questions to ask of any tool: can you delete a user and their attribution cleanly, can you export everything about one person, how long do backups retain deleted data, and does the vendor sub-process to services outside the EU for search, analytics, or AI features.",
        "Self-hosting answers most of these by construction, which is why it remains the default recommendation for teams with strict requirements.",
      ],
    },
  ],
  faq: [
    {
      question: "Is Kaneo Cloud hosted in the EU?",
      answer:
        "Yes. Kaneo Cloud runs on EU infrastructure, and it is the same MIT-licensed software as the self-hosted build, so you can move to your own servers at any time and take a JSON export with you.",
    },
    {
      question: "Does self-hosting make a tool GDPR compliant?",
      answer:
        "It removes the transfer question and puts you in control, but compliance is about your processes: lawful basis, retention, access requests, and deletion. Self-hosting makes those easier to satisfy, not automatic.",
    },
    {
      question: "Which open-source project tools can I host in the EU?",
      answer:
        "All of them, since you choose the server. Kaneo, Plane, OpenProject, Redmine, Taiga, Vikunja, WeKan, and Kanboard all run on any EU provider such as Hetzner, Scaleway, OVH, or a local host.",
    },
    {
      question: "Can I delete a user's data from Kaneo?",
      answer:
        "Yes. Accounts can be removed, projects export to JSON so you can inspect exactly what is held, and on a self-hosted instance you have direct access to the PostgreSQL database for anything a retention policy requires.",
    },
  ],
  related: [
    {
      label: "How to self-host with Docker",
      href: "/guides/self-host-project-management-docker",
    },
    { label: "Privacy policy", href: "/privacy" },
    { label: "All comparisons", href: "/alternatives" },
  ],
  updatedOn: "2026-08-19",
};
