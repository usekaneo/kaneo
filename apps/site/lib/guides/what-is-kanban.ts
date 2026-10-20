import type { Guide } from "./types";

export const whatIsKanban: Guide = {
  slug: "what-is-kanban",
  question: "What is kanban?",
  title: "What Is Kanban? Boards, Columns, and WIP Limits",
  description:
    "Kanban explained: how a kanban board works, WIP limits, pull instead of push, the metrics that matter, and how to set up a board your team keeps current.",
  summary:
    "How a kanban board works, why WIP limits matter, and how to set one up that people actually keep current.",
  answer:
    "Kanban is a way of managing work by making it visible on a board and limiting how much is in progress at once. Each task is a card, each column is a stage of work, and cards move left to right as work advances. Instead of planning fixed iterations, the team pulls the next item when it has capacity, which keeps work flowing and makes bottlenecks obvious.",
  sections: [
    {
      heading: "How a kanban board works",
      items: [
        {
          name: "Cards",
          body: "One card per piece of work, with enough on it to act: a clear title, an owner, and the context someone needs to start.",
        },
        {
          name: "Columns",
          body: "One column per stage the work really goes through, such as To Do, In Progress, Review, and Done. Copy your actual process rather than an idealised one.",
        },
        {
          name: "Pull, not push",
          body: "People take the next card when they finish one, instead of having work assigned to them as soon as it exists. Work starts when there is capacity, not when it is requested.",
        },
        {
          name: "Work-in-progress (WIP) limits",
          body: "A maximum number of cards allowed in a column at once. When a column is full, the team helps finish what is there before starting anything new.",
        },
        {
          name: "Explicit policies",
          body: 'Written rules for what it means for a card to enter or leave a column, such as "reviewed by a second person" before Done.',
          href: "/guides/definition-of-done-checklist",
        },
      ],
    },
    {
      heading: "Why WIP limits matter",
      body: [
        "Starting work feels like progress, so without a limit the In Progress column fills up. Every extra item in progress means more context switching, longer waits for review, and more half-finished work that delivers nothing yet.",
        "A WIP limit makes the bottleneck visible. If Review is always full, the fix is more reviewing, not more coding. A simple starting point is one or two items in progress per person, adjusted after a few weeks of watching where work piles up.",
      ],
    },
    {
      heading: "Kanban principles in short",
      body: [
        "Start with what you do now: kanban does not prescribe roles or meetings, it makes your current process visible and improves it step by step. Limit work in progress. Manage the flow of work rather than the people. Make policies explicit. Improve in small, evolutionary changes based on what the board shows.",
        "The method grew out of Toyota's production system, where cards (kanban means signboard in Japanese) signalled when a station needed more parts. David Anderson adapted it for knowledge work in the 2000s.",
      ],
    },
    {
      heading: "The metrics that matter",
      items: [
        {
          name: "Cycle time",
          body: "How long a card takes from starting work to done. Shorter and more predictable is the goal.",
        },
        {
          name: "Throughput",
          body: "How many cards the team finishes per week. Useful for forecasting without estimates.",
        },
        {
          name: "Work in progress",
          body: "How many cards are active right now. If it keeps rising, cycle time will follow.",
        },
        {
          name: "Blocked items",
          body: "Cards waiting on something outside the team. A rising count points to a dependency worth fixing.",
          href: "/guides/task-dependencies",
        },
      ],
    },
    {
      heading: "A kanban board in Kaneo",
      body: [
        "Every Kaneo project opens on a kanban board. Set the columns in the project's workflow settings to match how work really moves, and turn on Done for the column where finished work lands. Cards show labels, priority, assignees, and dates, and you can drag them between columns.",
        "Keep ideas out of the active board by putting them in the Backlog, so the board only shows work someone could pick up. Mark blocked work with a Blocks relation so the dependency is visible on the task.",
        'Kaneo does not enforce WIP limits. Most small teams agree a limit and check it at a weekly review; writing the limit into the column name, such as "In Progress (3)", is a simple reminder.',
      ],
    },
  ],
  faq: [
    {
      question: "What is the difference between kanban and scrum?",
      answer:
        "Scrum works in fixed sprints with set roles and ceremonies. Kanban has no sprints or required roles; work flows continuously and WIP limits control how much is active. Many teams use a mix.",
    },
    {
      question: "How many columns should a kanban board have?",
      answer:
        "As many as the distinct stages your work actually passes through, usually three to six. To Do, In Progress, Review, and Done is a common start. Add a column only when work genuinely waits in a new state.",
    },
    {
      question: "Is kanban agile?",
      answer:
        "Yes. Kanban is one of the most widely used agile methods. It shares the agile focus on delivering in small pieces and improving continuously, without scrum's fixed iterations.",
    },
    {
      question: "Is there a free kanban board?",
      answer:
        "Yes, several. Kaneo is free to self-host under the MIT license and includes a backlog, Gantt view, and single sign-on alongside the board. Our guide to free kanban software compares the main options.",
    },
  ],
  related: [
    { label: "Kanban vs scrum", href: "/guides/kanban-vs-scrum" },
    {
      label: "Best free kanban board software",
      href: "/guides/best-free-kanban-board-software",
    },
    {
      label: "Backlog grooming",
      href: "/guides/backlog-grooming",
    },
  ],
  updatedOn: "2026-10-19",
};
