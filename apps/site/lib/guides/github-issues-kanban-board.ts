import type { Guide } from "./types";

export const githubIssuesKanbanBoard: Guide = {
  slug: "github-issues-kanban-board",
  question:
    "Is there a self-hosted kanban board that syncs with GitHub issues?",
  title: "A self-hosted kanban board with two-way GitHub issue sync",
  description:
    "How to keep GitHub issues and a self-hosted board in sync both ways: what syncs, how branches and pull requests move tasks, and when GitHub Projects is enough.",
  summary:
    "What two-way issue sync covers, how pull requests move tasks, and when GitHub Projects is enough.",
  answer:
    "Yes. Kaneo is an MIT-licensed project board you can self-host that connects a project to a GitHub repository through a GitHub App. Tasks and issues sync in both directions, including titles, descriptions, comments, priority and status labels, and open or closed state. Branch pushes, opened pull requests, and merged pull requests can move tasks between columns automatically.",
  sections: [
    {
      heading: "What syncs, and in which direction",
      items: [
        {
          name: "Kaneo to GitHub",
          body: "Creating a task opens an issue with priority and status labels and a comment linking back to the task. Changes to the title, description, priority, and status follow it, and moving a task to done closes the issue.",
        },
        {
          name: "GitHub to Kaneo",
          body: "Opening an issue creates a task. Edits, comments, labels, and closing or reopening the issue update the linked task. Labels that are not priority or status labels sync as ordinary labels.",
        },
        {
          name: "Existing issues",
          body: "Import Issues brings in open issues with their labels and comments, links matching open pull requests, and skips bot comments. Large imports run in steps and can be resumed, and reimporting does not duplicate linked tasks.",
        },
      ],
    },
    {
      heading: "How branches and pull requests move tasks",
      body: [
        "Kaneo matches a branch to a task by a naming pattern, by default the project key and task number such as proj-123. Pushing that branch moves the task to in progress, opening a pull request moves it to in review, and merging moves it to done. Each mapping is configurable per project under workflow automation rules.",
        "Pull requests can also reference a task directly with the project key in the title or body, such as fix(PROJ-42), or with a GitHub issue reference like Closes #61 when that issue is linked to a task.",
      ],
    },
    {
      heading: "When GitHub Projects is enough",
      body: [
        "GitHub Projects is included on every GitHub plan, including Free, with board, table, and roadmap views and built-in workflows that set an item to Done when its issue closes or its pull request merges. There is no sync to configure. If all of your work is code in GitHub repositories and everyone who plans it has a GitHub account, it is the simpler choice.",
        "A separate board earns its place when work spans more than one repository host, when people without GitHub accounts plan alongside developers, when you need time tracking or Gantt and calendar views, or when your planning should not depend on a GitHub plan. GitHub Projects can only be self-hosted as part of GitHub Enterprise Server.",
      ],
    },
    {
      heading: "Setting it up",
      body: [
        "A self-hosted Kaneo instance registers its own GitHub App once, with read and write access to issues and read access to pull requests, contents, and metadata, and a webhook pointed at the Kaneo API. You then install the app on the repositories you want and connect each Kaneo project to one repository.",
        "Try it on a test repository first. Sync creates real issues and comments, so check the event-to-column mappings against your actual columns before connecting a busy repository.",
      ],
    },
  ],
  faq: [
    {
      question: "Does Kaneo sync GitHub issues both ways?",
      answer:
        "Yes. Tasks create issues and issues create tasks. Titles, descriptions, comments, labels, priority, status, and open or closed state stay in step in both directions.",
    },
    {
      question: "Can merging a pull request close a task?",
      answer:
        "Yes. By default a merged pull request moves its linked task to done. You can map branch pushes, opened pull requests, and merged pull requests to any column in the project's workflow settings.",
    },
    {
      question: "Can I import my existing GitHub issues?",
      answer:
        "Yes. Import Issues brings in open issues with their labels and comments and links matching open pull requests. It can be resumed if interrupted and does not create duplicates when run again.",
    },
    {
      question: "Does it work with GitLab or Gitea too?",
      answer:
        "Yes. Kaneo has GitLab and Gitea integrations with the same two-way issue sync and branch and merge request automation, including self-managed GitLab and self-hosted Gitea servers.",
    },
  ],
  related: [
    { label: "Kaneo vs GitHub Projects", href: "/github-projects-alternative" },
    {
      label: "GitHub integration docs",
      href: "/docs/core/integrations/github/setup",
    },
    {
      label: "Project management for Gitea",
      href: "/guides/gitea-project-management",
    },
  ],
  updatedOn: "2026-10-02",
};
