import type { Comparison } from "./types";

export const azureDevops: Comparison = {
  slug: "azure-devops",
  competitor: "Azure DevOps Boards",
  category: "saas",
  title: "Open-source Azure DevOps Boards alternative",
  description:
    "Kaneo is an open-source, self-hostable alternative to Azure DevOps Boards. Free under the MIT license, with no Microsoft account or Azure tenant required.",
  summary: "Work tracking without a Microsoft tenant or an Azure DevOps org.",
  heading: "The open-source alternative to Azure DevOps Boards",
  subheading:
    "Azure Boards is free for five people and then priced per user, and it only makes sense if the rest of your stack is Microsoft. Kaneo is a standalone tracker you can host anywhere.",
  verdict:
    "Kaneo is an open-source, MIT-licensed alternative to Azure DevOps Boards. Azure DevOps is free for the first 5 users and then $6 per user a month, tied to a Microsoft Entra tenant and the wider Azure DevOps suite. Kaneo is a standalone tracker with no tenant requirement, free to self-host for any number of people.",
  facts: {
    license: "MIT, versus a proprietary Microsoft licence",
    hosting: "Self-host anywhere, or EU-hosted cloud",
    sso: "Any OIDC provider, free on every Kaneo build",
    pricing: "$0 self-hosted, cloud from $4 / month",
  },
  rows: [
    { feature: "Open source (MIT)", kaneo: true, them: false },
    { feature: "Self-hostable", kaneo: "Free", them: "Server, paid licence" },
    { feature: "Own your data", kaneo: true, them: "In your Azure tenant" },
    {
      feature: "Free tier",
      kaneo: "Unlimited, self-hosted",
      them: "First 5 users",
    },
    {
      feature: "Identity requirement",
      kaneo: "Any OIDC provider",
      them: "Microsoft account",
    },
    { feature: "CI/CD pipelines", kaneo: false, them: true },
    { feature: "Setup", kaneo: "Minutes", them: "Org and project setup" },
    {
      feature: "Cloud pricing",
      kaneo: "From $4/mo",
      them: "$6/user/mo after 5",
    },
  ],
  reasons: [
    {
      title: "No tenant, no org sprawl",
      body: "Kaneo needs a server and a database. There is no organisation, no project collection, and no directory to reconcile before someone can be assigned a task.",
    },
    {
      title: "Understandable in a morning",
      body: "Azure Boards inherits work-item types, area paths, and iteration paths from TFS. Kaneo has projects, workflow columns, labels, and priorities.",
    },
    {
      title: "Portable by default",
      body: "MIT licence, public API, JSON export per project. Nothing about Kaneo assumes you will stay on one cloud provider.",
    },
  ],
  honestNote:
    "If your organisation is already on Microsoft Entra, and you use Azure Repos, Pipelines, and Test Plans, keeping work items in the same place is the sensible choice. Kaneo has no CI, no repos, and no test management, and it will not pretend otherwise.",
  faq: [
    {
      question: "What does Azure DevOps cost?",
      answer:
        "The first 5 users are free on the Basic plan, which includes Boards, Repos, Pipelines, and Artifacts. Additional users are $6 a month each, and Basic plus Test Plans is considerably more.",
    },
    {
      question: "Can Azure Boards be self-hosted?",
      answer:
        "Only through Azure DevOps Server, the on-premise edition, which is licensed separately and is a substantial install. Kaneo self-hosts with Docker and PostgreSQL under the MIT license at no cost.",
    },
    {
      question: "Is there an open-source alternative to Azure Boards?",
      answer:
        "Kaneo, Redmine, OpenProject, and Plane all cover work tracking without a Microsoft tenant. Kaneo is the lightest to run and includes SSO through any OIDC provider, including Entra ID.",
    },
    {
      question: "Can Kaneo connect to my Git repositories?",
      answer:
        "Kaneo integrates with GitHub and Gitea, and has outgoing webhooks and a documented public API for anything else, including Azure Repos.",
    },
  ],
  related: ["jira", "github-projects", "redmine", "openproject"],
  verifiedOn: "2026-08-19",
  sources: [
    {
      label: "Azure DevOps pricing",
      href: "https://azure.microsoft.com/en-us/pricing/details/devops/azure-devops-services/",
    },
    { label: "Kaneo pricing", href: "/pricing" },
  ],
};
