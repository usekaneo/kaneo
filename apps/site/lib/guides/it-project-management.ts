import type { Guide } from "./types";

export const itProjectManagement: Guide = {
  slug: "it-project-management",
  question: "What is IT project management?",
  title: "IT Project Management: Phases, Roles, and Tools",
  description:
    "IT project management explained: the phases of an IT project, who does what, the risks that sink rollouts and migrations, and what to look for in a tool.",
  summary:
    "Phases, roles, and the risks specific to IT rollouts and migrations, plus what an IT team needs from its tracker.",
  answer:
    "IT project management is planning and running projects that change an organisation's technology: system rollouts, migrations, infrastructure upgrades, security programmes, and internal tools. It uses the same basics as any project, scope, schedule, owners, and risks, but adds constraints of its own: cutover windows, integration with existing systems, security review, and users who need the old system to keep working until the new one is ready.",
  sections: [
    {
      heading: "Typical IT projects",
      items: [
        {
          name: "Rollouts",
          body: "Deploying a new system to staff: identity provider, device management, a new internal tool. The hard part is usually adoption, not installation.",
        },
        {
          name: "Migrations",
          body: "Moving data or services from one system to another: email, file storage, a database, or from one cloud to another. Data integrity and cutover planning dominate.",
        },
        {
          name: "Infrastructure upgrades",
          body: "New hardware, network changes, operating system or platform upgrades. Downtime windows and rollback plans are the critical items.",
        },
        {
          name: "Security and compliance programmes",
          body: "Implementing a control framework, an audit remediation, or single sign-on across tools. Evidence and sign-off matter as much as the work.",
        },
      ],
    },
    {
      heading: "The phases of an IT project",
      table: {
        columns: ["Phase", "What happens", "Output"],
        rows: [
          [
            "Initiation",
            "Define the problem, sponsor, and success measures",
            "Project charter or brief",
          ],
          [
            "Planning",
            "Scope, work breakdown, schedule, risks, change and cutover plan",
            "Project plan and timeline",
          ],
          [
            "Build and test",
            "Configure, integrate, migrate test data, run user acceptance testing",
            "Tested system, signed-off test results",
          ],
          [
            "Cutover",
            "Freeze, migrate, switch over, verify",
            "Live system and rollback decision",
          ],
          [
            "Hypercare",
            "Extra support for the first weeks, fix issues fast",
            "Stable system, open issues handed to support",
          ],
          [
            "Closure",
            "Decommission the old system, document, review",
            "Lessons learned, retired system",
          ],
        ],
      },
    },
    {
      heading: "Risks specific to IT projects",
      body: [
        "Underestimated integrations. Every system the new one must talk to is a dependency with its own owner and schedule. List them during planning and confirm each with its owner.",
        "No rollback plan. A cutover without a tested way back turns a bad night into a bad month. Decide in advance what failure looks like and who calls the rollback.",
        "Data quality. Migrations surface years of inconsistent data. Run a trial migration early, on real data, and budget time to clean it.",
        "Adoption. A system nobody uses correctly has failed regardless of the go-live date. Plan training and support into the timeline, not after it.",
      ],
    },
    {
      heading: "What an IT team needs from its tracker",
      items: [
        {
          name: "Access control",
          body: "Single sign-on with your identity provider, roles, and the ability to limit contractors or other departments to the projects they work on.",
        },
        {
          name: "Data location",
          body: "Project data often includes system details, credentials references, and vulnerabilities. Many IT teams need it on infrastructure they control.",
          href: "/guides/cloud-vs-on-premise-project-management",
        },
        {
          name: "Scheduling",
          body: "A Gantt or timeline view for cutovers and change windows, and dependencies between tasks.",
          href: "/guides/what-is-a-gantt-chart",
        },
        {
          name: "Integrations",
          body: "Notifications to the chat tool the team uses, webhooks, and an API so monitoring and scripts can create or update tasks.",
        },
      ],
    },
    {
      heading: "How Kaneo fits",
      body: [
        "Kaneo can run on your own infrastructure with Docker Compose or the Helm chart, so project data stays inside your network. Single sign-on works with any OpenID Connect provider, such as Keycloak, Okta, or Microsoft Entra ID, in the free build.",
        "Workspace roles (viewer, member, admin, owner) control what people can do, and per-member project access keeps contractors and other teams to the projects they need, including through their API keys. Projects have a board, backlog, and Gantt and calendar views, with Blocks relations for dependencies.",
        "Outgoing webhooks post task activity to Slack, Discord, Mattermost, Telegram, or your own endpoint, and a public API and MCP server cover scripts and automation.",
      ],
    },
  ],
  faq: [
    {
      question: "What does an IT project manager do?",
      answer:
        "Plans the project, coordinates the technical teams, vendors, and business stakeholders, manages risks and the schedule, and owns the cutover and handover to support. On small teams this is often a senior engineer or IT lead rather than a dedicated role.",
    },
    {
      question: "Is IT project management agile or waterfall?",
      answer:
        "Often both. Fixed cutover dates and vendor contracts push towards up-front planning, while configuration and internal tools work well in agile increments. A common pattern is a planned timeline with agile work inside each phase.",
    },
    {
      question: "What is hypercare?",
      answer:
        "A period after go-live, typically two to six weeks, with extra support and faster fixes while users adjust and early issues surface. It ends with a formal handover to normal support.",
    },
    {
      question: "Should IT teams self-host their project management tool?",
      answer:
        "If the projects involve sensitive system details or the organisation requires data to stay in its own infrastructure, self-hosting is a good fit, and IT teams usually have the skills to run it.",
    },
  ],
  related: [
    {
      label: "Cloud vs on-premise project management",
      href: "/guides/cloud-vs-on-premise-project-management",
    },
    {
      label: "Project management tools that include SSO for free",
      href: "/guides/project-management-tools-with-free-sso",
    },
    {
      label: "Task dependencies in project management",
      href: "/guides/task-dependencies",
    },
  ],
  updatedOn: "2026-10-19",
};
