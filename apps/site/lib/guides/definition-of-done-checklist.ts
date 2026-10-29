import type { Guide } from "./types";

export const definitionOfDoneChecklist: Guide = {
  slug: "definition-of-done-checklist",
  question: "What is a definition of done?",
  title: "Definition of Done: Checklist Template and Examples",
  description:
    "A copyable definition of done checklist for software teams, examples for design and content work, and how it differs from acceptance criteria.",
  summary:
    "A checklist template you can copy, examples by team, and how it differs from acceptance criteria.",
  answer:
    "A definition of done is a short checklist, agreed by the whole team, that every piece of work must pass before anyone calls it finished. For a software team it usually covers code review, tests, documentation, and release. It applies to every task in the same way, which is what separates it from acceptance criteria, which are written for one task at a time.",
  sections: [
    {
      heading: "Definition of done vs acceptance criteria",
      table: {
        columns: ["", "Definition of done", "Acceptance criteria"],
        rows: [
          [
            "Applies to",
            "Every task the team finishes",
            "One task or user story",
          ],
          [
            "Answers",
            "Is this finished to our quality standard?",
            "Does this do what was asked?",
          ],
          [
            "Written by",
            "The team, once, and revised occasionally",
            "Whoever writes the task, with the requester",
          ],
          [
            "Example",
            "Reviewed by a second engineer",
            "A monthly customer can switch to annual billing",
          ],
        ],
      },
    },
    {
      heading: "A definition of done checklist template",
      body: [
        "This is a starting point for a software team. Copy it, delete what does not apply, and add the checks your team keeps forgetting. Keep it short enough that people actually read it; six to ten items is typical.",
      ],
      table: {
        columns: ["Check", "What it means in practice"],
        rows: [
          [
            "Acceptance criteria met",
            "Every criterion on the task is checked by someone other than the author.",
          ],
          [
            "Code reviewed",
            "At least one other engineer approved the change, and review comments are resolved.",
          ],
          [
            "Tests pass",
            "New behaviour has tests, and the full suite passes in CI.",
          ],
          [
            "No known regressions",
            "The areas around the change were checked, and any new bug found has its own task.",
          ],
          [
            "Docs updated",
            "User docs, API reference, and changelog reflect the change, or the task says why none are needed.",
          ],
          [
            "Accessible",
            "New UI works with a keyboard and a screen reader, with sufficient contrast.",
          ],
          [
            "Released",
            "The change is merged and deployed to production, or behind a flag that is documented.",
          ],
          [
            "Task closed",
            "The task is in a done column, linked to the pull request, with follow-ups filed separately.",
          ],
        ],
      },
    },
    {
      heading: "Examples for other kinds of teams",
      items: [
        {
          name: "Design team",
          body: "Designs cover empty, loading, and error states. Reviewed with an engineer for feasibility. Components come from the design system or are added to it. Files are named, organised, and linked from the task. Handoff notes cover interactions and edge cases.",
        },
        {
          name: "Content and marketing team",
          body: "Fact-checked and proofread by a second person. Title and meta description within length. Links and images checked. Approved by whoever owns the topic. Published, shared, and added to the tracking sheet.",
        },
        {
          name: "Operations or infrastructure team",
          body: "Change tested in staging. Rollback steps written down. Monitoring and alerts cover the new component. Runbook updated. Change announced to the people it affects.",
        },
      ],
    },
    {
      heading: "How to write your team's definition of done",
      items: [
        {
          name: "Start from recent problems",
          body: "Look at the last few things that came back after being called done. Each one usually points at a missing check: no review, no docs, never actually deployed.",
        },
        {
          name: "Write it together",
          body: "A definition the team agreed on gets followed. One handed down by a manager gets ticked without being read.",
        },
        {
          name: "Make every item checkable",
          body: '"Good quality" is not a check. "Reviewed by a second engineer" is. If two people could disagree about whether an item is met, rewrite it.',
        },
        {
          name: "Keep it achievable",
          body: "If the team cannot meet it on every task today, it will be ignored on every task. Add stricter checks once the basics hold.",
        },
        {
          name: "Review it every few months",
          body: "Remove checks that never catch anything and add ones for problems that keep slipping through. Retrospectives are a natural place to do this.",
        },
      ],
    },
    {
      heading: "Using a definition of done in Kaneo",
      body: [
        "Paste the checklist into the task description as checkboxes. Tick each item as it is done, and anyone opening the task sees what is left. Keep the master copy in the project description so it is easy to find and copy.",
        "In the project's workflow settings, turn on Done for the column where finished work lands, and add a Review column before it so work waits there while the checklist is completed. A column's name alone does not mark work as complete in Kaneo; the Done setting does.",
        "If you connect GitHub, Gitea, or GitLab, automations can move a task when its pull request merges. Point that event at the Review column rather than Done if your definition includes steps that happen after merge, such as docs or a production deploy.",
      ],
    },
  ],
  faq: [
    {
      question: "Who owns the definition of done?",
      answer:
        "The whole team. In Scrum the Scrum Team creates it, using the organisation's standard as a minimum where one exists. In practice whoever runs the team's retrospectives keeps it current.",
    },
    {
      question: "Is the definition of done the same for every task?",
      answer:
        "Yes, that is the point of it. Task-specific conditions belong in acceptance criteria. If some kinds of work need different checks, such as a bug fix versus a new feature, keep one short shared list and add the extras to the acceptance criteria.",
    },
    {
      question: "What is a definition of ready?",
      answer:
        "The mirror image: a checklist a task must pass before work starts, such as clear acceptance criteria, an estimate, and no open blockers. It stops half-defined work from entering the board.",
    },
    {
      question: "Is definition of done only for Scrum?",
      answer:
        "No. It comes from Scrum, but any team that finishes work benefits from agreeing what finished means. Kanban teams often encode it as the exit criteria of their last column.",
    },
  ],
  related: [
    { label: "Acceptance criteria", href: "/guides/acceptance-criteria" },
    { label: "What is project scope?", href: "/guides/what-is-project-scope" },
    {
      label: "What is project planning?",
      href: "/guides/what-is-project-planning",
    },
    {
      label: "Two-way GitHub issue sync for a self-hosted board",
      href: "/guides/github-issues-kanban-board",
    },
  ],
  updatedOn: "2026-10-19",
};
