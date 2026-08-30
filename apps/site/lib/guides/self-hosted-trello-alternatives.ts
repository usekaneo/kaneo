import type { Guide } from "./types";

export const selfHostedTrelloAlternatives: Guide = {
  slug: "self-hosted-trello-alternatives",
  question: "What is the best self-hosted Trello alternative?",
  title: "Self-hosted Trello alternatives in 2026",
  description:
    "Trello cannot be self-hosted. These open-source kanban boards can: Kaneo, PLANKA, WeKan, Kanboard, Vikunja, and Focalboard, compared by licence and upkeep.",
  summary:
    "Trello has no on-premise edition. Here are the boards that do, and their catches.",
  answer:
    "Trello has no self-hosted edition, so a self-hosted Trello alternative means switching tools. Kaneo, PLANKA, WeKan, Kanboard, and Vikunja are the main options. Kaneo is MIT licensed with single sign-on and a backlog in the free build, PLANKA is closest to Trello's card design but keeps SSO for its paid tier, and WeKan and Kanboard are the most minimal.",
  sections: [
    {
      heading: "The options",
      items: [
        {
          name: "Kaneo",
          meta: "MIT",
          href: "/trello-alternative",
          body: "A clean board with a backlog, workflow columns, labels, priorities, assignees, comments, attachments, time tracking, and workspace roles. One container plus PostgreSQL, single sign-on through any OIDC provider, JSON export per project. Best if you expect to outgrow a pure board.",
        },
        {
          name: "PLANKA",
          meta: "Fair Use, source-available",
          href: "/planka-alternative",
          body: "The closest thing to Trello's card experience, with an active team behind it. Since 2.2, OIDC single sign-on is in the paid Pro tier, and the licence is source-available rather than OSI open source. It also has no export, which matters if you ever want to leave.",
        },
        {
          name: "WeKan",
          meta: "MIT",
          href: "/wekan-alternative",
          body: "The veteran open-source kanban board, with swimlanes and a long list of install methods. Meteor and MongoDB under the hood. Board-focused, no backlog layer.",
        },
        {
          name: "Kanboard",
          meta: "MIT",
          href: "/kanboard-alternative",
          body: "Minimal PHP, optionally SQLite, negligible resource use. Plain to look at and extended through plugins. The choice when the board is for you and two colleagues, not the company.",
        },
        {
          name: "Vikunja",
          meta: "AGPLv3",
          href: "/vikunja-alternative",
          body: "More of a task manager than a board, with list, table, gantt, and calendar views. Excellent for personal use. Some features, including time tracking, belong to the paid Vikunja Pro add-on.",
        },
        {
          name: "Focalboard",
          meta: "Mixed licensing, community maintained",
          href: "/focalboard-alternative",
          body: "Worth knowing about mostly so you can rule it out. Mattermost unbundled the plugin in 2023 and the standalone project is looking for maintainers, though Mattermost Boards continues as a plugin.",
        },
      ],
    },
    {
      heading: "What to check before you commit",
      body: [
        "Can you export? Trello gives you board JSON on the way out, and the tool you move to should offer the same courtesy. PLANKA currently does not have an export feature, which is why our importer talks to its API directly.",
        "Where does single sign-on live? On a self-hosted board, this is the feature most likely to sit behind a paid tier. Kaneo, WeKan, and Vikunja include it free.",
        "Who runs it in six months? Every self-hosted board needs backups, TLS, and updates. Prefer the smallest thing that does the job: one container and PostgreSQL is a very different commitment from a multi-service platform.",
      ],
    },
    {
      heading: "Getting your Trello boards out",
      body: [
        "Trello exports each board to JSON from the board menu, including cards, lists, labels, members, and comments. Attachments are links rather than files, so download them separately if they matter.",
        "From there it is a scripting job against the target tool's API. Kaneo has a documented public API and per-project JSON import, so a board of a few hundred cards is an afternoon. Import into a scratch project first and check assignee matching, which usually happens by email address.",
      ],
    },
  ],
  faq: [
    {
      question: "Can Trello be self-hosted?",
      answer:
        "No. Trello is an Atlassian cloud product with no on-premise or self-hosted edition. Running a Trello-style board on your own server means using a different tool.",
    },
    {
      question: "What is the closest open-source tool to Trello?",
      answer:
        "PLANKA is closest in card design and interaction. Kaneo keeps the same simplicity and adds a backlog, workflows, roles, and time tracking, and is MIT licensed with SSO included.",
    },
    {
      question: "Is there a free self-hosted kanban board?",
      answer:
        "Several. Kaneo, WeKan, and Kanboard are MIT licensed and free to self-host with no user limits or feature gates. Vikunja is free under AGPLv3 with a paid Pro add-on for some features.",
    },
    {
      question: "How do I import Trello boards into Kaneo?",
      answer:
        "Export the board to JSON from Trello, then create the tasks through Kaneo's public API or its per-project JSON import. There is no one-click importer yet. If you want one, open an issue on GitHub, since import work is prioritised by demand.",
    },
  ],
  related: [
    { label: "Kaneo vs Trello", href: "/trello-alternative" },
    { label: "Kaneo vs PLANKA", href: "/planka-alternative" },
    {
      label: "Best free kanban board software",
      href: "/guides/best-free-kanban-board-software",
    },
  ],
  updatedOn: "2026-08-19",
};
