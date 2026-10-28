import type { Guide } from "./types";

export const cloudVsOnPremiseProjectManagement: Guide = {
  slug: "cloud-vs-on-premise-project-management",
  question: "Should project management software be cloud or on-premise?",
  title: "Cloud vs On-Premise Project Management Software",
  description:
    "Cloud vs on-premise project management compared on cost, data control, security, upkeep, and compliance, with a checklist for choosing between them.",
  summary:
    "Cost, data control, security, and upkeep compared, and the questions that settle it for your team.",
  answer:
    "Cloud project management software is hosted by the vendor and paid per user, so there is nothing to run, but your data lives on their servers under their terms. On-premise (self-hosted) software runs on infrastructure you control, which gives you full control of data, access, and updates in exchange for running it yourself. Choose cloud when nobody wants to operate a service; choose on-premise when data location, compliance, cost at scale, or network isolation matter more.",
  sections: [
    {
      heading: "Side by side",
      table: {
        columns: ["", "Cloud (SaaS)", "On-premise (self-hosted)"],
        rows: [
          ["Setup", "Sign up and start", "Deploy and configure a service"],
          [
            "Cost shape",
            "Per user, per month, rising with headcount",
            "Server and staff time; often flat as the team grows",
          ],
          [
            "Data location",
            "Vendor's regions and subprocessors",
            "Wherever you run it",
          ],
          [
            "Access control",
            "Vendor's options, SSO often on paid tiers",
            "Your network, your identity provider",
          ],
          [
            "Updates",
            "Automatic, on the vendor's schedule",
            "When you choose to apply them",
          ],
          [
            "Availability",
            "Vendor's uptime and support",
            "Your responsibility",
          ],
          [
            "Exit",
            "Depends on the vendor's export",
            "You already hold the database",
          ],
          ["Offline or air-gapped", "Not possible", "Possible"],
        ],
      },
    },
    {
      heading: "Reasons teams choose cloud",
      body: [
        "Nobody has to run it. There are no servers, backups, upgrades, or certificates to look after, and the vendor handles uptime. For a small team without anyone who wants that job, this is usually decisive.",
        "It is quick to start and easy to stop. A trial takes minutes, and per-user pricing is cheap for a handful of people.",
      ],
    },
    {
      heading: "Reasons teams choose on-premise",
      items: [
        {
          name: "Data control and sovereignty",
          body: "Project data often includes customer names, contracts, security issues, and roadmaps. Self-hosting keeps it in a jurisdiction and on infrastructure you choose.",
          href: "/guides/eu-hosted-project-management-gdpr",
        },
        {
          name: "Compliance",
          body: "Regulated industries and public bodies may need specific hosting, audit access, or data residency that a multi-tenant service cannot promise.",
        },
        {
          name: "Cost at scale",
          body: "Per-seat pricing grows with every hire. An open-source tool on your own server costs the same for ten people or two hundred.",
        },
        {
          name: "Single sign-on without the upcharge",
          body: "Many cloud tools put SSO on their top tier. Self-hosted open-source tools often include it, and connect to the identity provider you already run.",
          href: "/guides/project-management-tools-with-free-sso",
        },
        {
          name: "Isolated networks",
          body: "Teams on internal or air-gapped networks cannot reach a SaaS tool at all.",
        },
      ],
    },
    {
      heading: "The real cost of self-hosting",
      body: [
        "The server is the small part: a modest virtual machine is enough for most teams. The real cost is attention. Someone owns backups and tests restoring them, applies updates, renews certificates, and watches disk space. For a well-packaged tool that is perhaps an hour of setup and ten minutes a month after.",
        "If nobody will own that, self-hosting turns into an outdated, unbacked-up server, which is worse than either option. Decide who owns it before you deploy.",
      ],
    },
    {
      heading: "Questions that settle it",
      items: [
        {
          name: "Does someone want to run it?",
          body: "If no one will own backups and updates, choose cloud, or an open-source tool's managed plan.",
        },
        {
          name: "Where must the data live?",
          body: "If a contract, regulator, or customer requires a specific location, check whether a cloud vendor can guarantee it before ruling out self-hosting.",
        },
        {
          name: "What will it cost at double the headcount?",
          body: "Per-user pricing that looks cheap at eight people can look different at forty.",
        },
        {
          name: "Can you leave?",
          body: "Check the export before you start. Open-source tools let you move between hosted and self-hosted without changing products.",
        },
      ],
    },
    {
      heading: "Kaneo supports both",
      body: [
        "Kaneo is open source under the MIT license. Self-host it for free with Docker Compose or the Helm chart: the app runs in one container with PostgreSQL, Redis is optional, and single sign-on works with any OpenID Connect provider in the free build.",
        "If you would rather not run it, Kaneo Cloud is the same product, hosted in the EU, from $4 a month for one user and $5 per user for teams. You can move a project between the two with Kaneo's own import and export.",
      ],
    },
  ],
  faq: [
    {
      question: "Is on-premise more secure than cloud?",
      answer:
        "Not automatically. A well-run cloud service can be more secure than a neglected server. On-premise gives you control over who can reach the data and where it lives; it is more secure only if you patch it, back it up, and restrict access.",
    },
    {
      question: "Is self-hosted the same as on-premise?",
      answer:
        "Close enough for most purposes. On-premise strictly means your own hardware; self-hosted includes your own account at a cloud provider. Either way you run the software and control the data.",
    },
    {
      question: "Is self-hosting cheaper than SaaS?",
      answer:
        "For open-source tools, usually yes beyond a handful of users, because the licence is free and a small server is cheap. Count the staff time for backups and updates too.",
    },
    {
      question: "Can I switch from cloud to self-hosted later?",
      answer:
        "With an open-source tool that offers both, yes. With a proprietary SaaS tool you are limited to whatever export the vendor provides and a migration to a different product.",
    },
  ],
  related: [
    {
      label: "How to self-host project management with Docker",
      href: "/guides/self-host-project-management-docker",
    },
    {
      label: "EU-hosted project management and GDPR",
      href: "/guides/eu-hosted-project-management-gdpr",
    },
    { label: "Pricing", href: "/pricing" },
  ],
  updatedOn: "2026-10-19",
};
