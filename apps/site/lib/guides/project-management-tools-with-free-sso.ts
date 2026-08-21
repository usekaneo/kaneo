import type { Guide } from "./types";

export const projectManagementToolsWithFreeSso: Guide = {
  slug: "project-management-tools-with-free-sso",
  question: "Which project management tools include SSO for free?",
  title: "Project management tools that include SSO for free",
  description:
    "Single sign-on is the most commonly paywalled feature in project management. Here is where SSO is free, where it costs, and what the SSO tax actually looks like.",
  summary:
    "Where single sign-on is included, where it costs extra, and why it keeps moving behind paywalls.",
  answer:
    "Among self-hosted tools, Kaneo, Vikunja, and WeKan include OIDC single sign-on in their free builds, and Redmine and Kanboard can do it through plugins. OpenProject, Plane, and PLANKA reserve it for a paid edition or tier. Among hosted SaaS tools, SSO is almost always an Enterprise-tier feature: Asana, monday.com, and Shortcut all place SAML on their top plans, Jira requires an Atlassian Guard subscription or its Enterprise tier, and Notion and ClickUp put it mid-tier.",
  sections: [
    {
      heading: "Why single sign-on ends up behind a paywall",
      body: [
        "Because it is the feature that identifies a buyer. A team asking for SAML or OIDC has an identity provider, which means an IT function, which means a budget. Pricing pages have quietly used SSO as a proxy for company size for a decade, and the industry has a name for the result.",
        "The security argument against this is straightforward. Single sign-on is how an organisation offboards someone in one place, enforces multi-factor authentication, and stops password reuse. Charging a premium for it means the smallest and least-resourced teams get the least secure defaults.",
        "It matters more in self-hosted software, because the promise there is that running it yourself is the free path. If authentication is the part that is not free, the promise is thinner than it looks.",
      ],
    },
    {
      heading: "Self-hosted tools: where SSO sits",
      items: [
        {
          name: "Kaneo",
          meta: "Free, every build",
          href: "/planka-alternative",
          body: "Google, GitHub, Discord, or any OIDC provider, configured with environment variables. No paid edition, so it cannot move later without changing the licence of a project that is MIT throughout.",
        },
        {
          name: "Vikunja",
          meta: "Free",
          href: "/vikunja-alternative",
          body: "OIDC is supported in the free build. Note that other features, including time tracking and audit logs, belong to the paid Vikunja Pro add-on for self-hosters.",
        },
        {
          name: "WeKan",
          meta: "Free",
          href: "/wekan-alternative",
          body: "OAuth2 and OIDC providers are supported on the MIT-licensed build.",
        },
        {
          name: "Redmine and Kanboard",
          meta: "Plugin",
          href: "/redmine-alternative",
          body: "Both can authenticate against an identity provider through community plugins, with the usual caveat that plugins are pinned to versions and maintained by volunteers.",
        },
        {
          name: "OpenProject",
          meta: "Enterprise add-on",
          href: "/openproject-alternative",
          body: "SAML, OIDC, Kerberos, and Okta support belong to the Enterprise add-on rather than the GPLv3 Community edition.",
        },
        {
          name: "Plane",
          meta: "Paid tiers",
          href: "/plane-alternative",
          body: "SSO with SAML and OIDC starts at the Pro tier, with LDAP and group sync on Enterprise Grid.",
        },
        {
          name: "PLANKA",
          meta: "Pro tier since 2.2",
          href: "/planka-alternative",
          body: "OIDC moved into the paid Pro tier in version 2.2. Self-hosters who had been signing in with OIDC found those accounts deactivated after upgrading.",
        },
      ],
    },
    {
      heading: "Hosted tools: what SSO costs",
      body: [
        "Asana places SAML on Enterprise, which is quote-only. Shortcut places SSO on Enterprise. monday.com places it on Enterprise. Jira Cloud requires Atlassian Guard, a separate per-user subscription, unless you are on Enterprise, which includes it. Notion includes SAML from Business at $20 per member a month. ClickUp includes Google SSO from Business and custom SAML at the Enterprise level. GitHub includes SAML from Enterprise at $21 per user a month.",
        "The pattern is consistent enough to plan around: if your company adopts an identity provider, assume every hosted tool in your stack will move up at least one tier.",
      ],
    },
  ],
  faq: [
    {
      question: "What is the SSO tax?",
      answer:
        "The term for the large price jump between a vendor's standard plan and the plan that includes single sign-on. It is common enough that a public list, sso.tax, has tracked it for years. The criticism is that it prices a basic security control as a luxury.",
    },
    {
      question: "Which self-hosted project management tool has free SSO?",
      answer:
        "Kaneo, Vikunja, and WeKan include OIDC on the free build. Kaneo also has no paid edition at all, so there is no tier for it to move into later.",
    },
    {
      question: "How do I set up OIDC single sign-on in Kaneo?",
      answer:
        "Set the client ID, client secret, and the provider's authorization, token, and user-info URLs as environment variables, or point CUSTOM_OAUTH_DISCOVERY_URL at its discovery document, then restart the container. Google, GitHub, and Discord have dedicated settings, and any standards-compliant provider such as Keycloak, Authentik, Pocket ID, or Entra ID works through the custom OAuth configuration.",
    },
    {
      question: "Does SSO require an enterprise identity provider?",
      answer:
        "No. Signing in with a Google or GitHub account is single sign-on for most small teams, and both are free. A dedicated provider such as Keycloak or Authentik is worth it once you want central offboarding and group mapping.",
    },
  ],
  related: [
    { label: "Kaneo vs PLANKA", href: "/planka-alternative" },
    { label: "Kaneo vs OpenProject", href: "/openproject-alternative" },
    {
      label: "Custom OAuth and OIDC setup",
      href: "/docs/core/social-providers/custom-oauth",
    },
  ],
  updatedOn: "2026-08-19",
};
