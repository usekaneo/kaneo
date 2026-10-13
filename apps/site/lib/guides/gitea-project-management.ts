import type { Guide } from "./types";

export const giteaProjectManagement: Guide = {
  slug: "gitea-project-management",
  question: "What is the best project management tool for Gitea?",
  title: "Project management for Gitea: built-in boards or a synced tracker",
  description:
    "Gitea's built-in project boards versus a self-hosted tracker with two-way Gitea issue sync: what each covers, how pull requests move tasks, and how to connect them.",
  summary:
    "When Gitea's own boards are enough, and what a synced tracker adds on top.",
  answer:
    "For small teams whose work is all code, Gitea's built-in Projects boards are often enough. When you need a backlog, priorities, boards that move on their own, Gantt and calendar views, or a place for work that is not code, Kaneo is an MIT-licensed tracker you can self-host next to Gitea. It syncs tasks and issues in both directions and moves tasks when branches are pushed and pull requests are opened or merged.",
  sections: [
    {
      heading: "What Gitea gives you out of the box",
      body: [
        "Gitea has built-in Projects: kanban boards where issues and pull requests are drag-and-drop cards. A project can belong to a repository, an organisation, or a user, and recent releases added milestone filters, issues in more than one project, and a REST API for boards. Issues also carry due dates, dependencies, and a stopwatch for time tracking.",
        "What Gitea boards do not have is automation. Closing an issue or merging a pull request does not move its card, and the upstream requests for that are still open. There is no priority field either, so teams use scoped labels such as priority/high. For a small team that lives in the repository, that is often fine.",
      ],
    },
    {
      heading: "What a synced tracker adds",
      items: [
        {
          name: "Two-way issue sync",
          href: "/docs/core/integrations/gitea/setup",
          body: "Creating a task in Kaneo opens a Gitea issue, and opening an issue in Gitea creates a task. Titles, descriptions, comments, labels, priority, and open or closed state stay in step in both directions.",
        },
        {
          name: "Automation from branches and pull requests",
          body: "Kaneo matches branches to tasks by a naming pattern you choose. Pushes, opened pull requests, and merged pull requests move the linked task to the columns you map in the project's workflow settings.",
        },
        {
          name: "Planning beyond the repository",
          body: "A backlog, a priority field, Gantt and calendar views, custom fields, and workspace roles, plus room for design, ops, and client work that should not become repository issues.",
        },
        {
          name: "Existing issues",
          body: "Import Issues pulls in a repository's existing issues after you verify the connection, so you can start from where you are rather than from an empty board.",
        },
      ],
    },
    {
      heading: "How the connection works",
      body: [
        "Each Kaneo project connects to one Gitea repository using a personal access token that can read the account and repository and write issues. Kaneo verifies the token and repository permissions before you save.",
        "Gitea then sends push, pull request, issue, and issue comment events to a webhook URL and secret that Kaneo shows after saving. Kaneo needs to reach your Gitea API, and Gitea needs to reach Kaneo's webhook, so on a private network make sure both directions are open.",
      ],
    },
    {
      heading: "Running both yourself",
      body: [
        "Kaneo is one application container plus PostgreSQL, so it sits comfortably on the same host or Docker network as Gitea. Single sign-on is included in the free build, so you can point both at the same OIDC provider and keep one login for code and planning.",
      ],
    },
  ],
  faq: [
    {
      question: "Does Gitea have a kanban board?",
      answer:
        "Yes. Gitea's built-in Projects are kanban boards with issues and pull requests as cards, at repository, organisation, or user level. They do not move cards automatically when issues close or pull requests merge.",
    },
    {
      question: "Does Kaneo sync Gitea issues both ways?",
      answer:
        "Yes. Tasks create issues and issues create tasks, and edits, comments, labels, priority, and open or closed state sync in both directions.",
    },
    {
      question: "Does the Gitea integration work with Forgejo?",
      answer:
        "Kaneo's integration is built and documented for Gitea. Forgejo serves its API at the same path and aims to stay compatible with Gitea's, but since its 2024 hard fork that is no longer guaranteed, so test the connection on a scratch repository before relying on it.",
    },
    {
      question: "Is Kaneo free to self-host next to Gitea?",
      answer:
        "Yes. Kaneo is MIT licensed and free to self-host with every feature, including single sign-on and the Gitea, GitHub, and GitLab integrations.",
    },
  ],
  related: [
    {
      label: "Gitea integration docs",
      href: "/docs/core/integrations/gitea/setup",
    },
    {
      label: "Kanban board with GitHub issue sync",
      href: "/guides/github-issues-kanban-board",
    },
    {
      label: "Self-host project management with Docker",
      href: "/guides/self-host-project-management-docker",
    },
  ],
  updatedOn: "2026-10-02",
};
