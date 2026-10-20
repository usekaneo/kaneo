import type { Guide } from "./types";

export const backlogGrooming: Guide = {
  slug: "backlog-grooming",
  question: "What is backlog grooming?",
  title: "Backlog Grooming: How to Run Backlog Refinement",
  description:
    "What backlog grooming (backlog refinement) is, who joins, a 45-minute agenda, a checklist for ready work, and the mistakes that make backlogs rot.",
  summary:
    "A regular session that keeps the backlog short, ordered, and ready, with an agenda you can reuse.",
  answer:
    "Backlog grooming, now usually called backlog refinement, is a regular session where the team reviews upcoming work so the top of the backlog is ready to start. Items get clarified, split, estimated, and put in order, and items nobody will do get removed. Done well, it means planning takes minutes and nobody starts work they do not understand.",
  sections: [
    {
      heading: "What happens in a refinement session",
      items: [
        {
          name: "Clarify",
          body: 'Rewrite vague items so the outcome is clear. "Fix login" becomes "Users with expired passwords can reset them from the sign-in page".',
        },
        {
          name: "Split",
          body: "Break items that are too big to finish in a few days into smaller ones that each deliver something on their own.",
        },
        {
          name: "Estimate",
          body: "Give a rough size, in points, days, or simply small, medium, large. The conversation matters more than the number; a wide disagreement means people understand the item differently.",
        },
        {
          name: "Order",
          body: "Put the most valuable and most urgent items at the top. Only the top of the list needs a precise order.",
        },
        {
          name: "Remove",
          body: "Delete or close items that are out of date, duplicated, or that the team has decided not to do. A smaller backlog is easier to trust.",
        },
      ],
    },
    {
      heading: "A 45-minute agenda",
      table: {
        columns: ["Starts at", "What to do"],
        rows: [
          [
            "0:00",
            "Check what changed since last time: new requests, finished work, new priorities.",
          ],
          [
            "0:05",
            "Walk the top 10 to 15 items: clarify, split, estimate, and add acceptance criteria.",
          ],
          [
            "0:30",
            "Reorder the top of the list and agree what is ready for the next stretch of work.",
          ],
          ["0:40", "Archive or delete items nobody argued to keep."],
        ],
      },
    },
    {
      heading: "Who should attend",
      body: [
        "The person who owns priorities (a product owner, product manager, or team lead) runs it. Two or three people who will do the work join to catch missing tasks and bad estimates. A designer or tester joins when the items need them. The whole team does not need to be there every time, as long as everyone can see the result.",
        "Once a week or once per sprint is typical. Teams that find refinement painful usually do it too rarely, so each session has too much to get through.",
      ],
    },
    {
      heading: "When an item is ready",
      items: [
        {
          name: "Clear outcome",
          body: "Anyone on the team could explain what done looks like.",
        },
        {
          name: "Acceptance criteria",
          body: "The specific conditions are written on the item, not in someone's head.",
        },
        {
          name: "Small enough",
          body: "It can be finished in a few days by one person or a pair.",
        },
        {
          name: "No open blockers",
          body: "Anything it depends on is done or scheduled.",
          href: "/guides/task-dependencies",
        },
        {
          name: "Estimated",
          body: "The team has a rough size and agrees on it.",
        },
      ],
    },
    {
      heading: "Mistakes that make backlogs rot",
      body: [
        "Keeping everything. A backlog with five hundred items is an archive, not a plan. If something has sat untouched for six months, it is safe to close; it will come back if it matters.",
        "Refining too far ahead. Detailed work on items three months out is usually wasted, because by then priorities have changed. Keep the next two or three weeks ready and leave the rest rough.",
        "Treating it as a status meeting. Refinement is about future work. Progress on current work belongs somewhere else.",
      ],
    },
    {
      heading: "Refining a backlog in Kaneo",
      body: [
        "Each Kaneo project has a Backlog view, separate from the board, for work that is planned but not started. New ideas go there with Plan, and they do not need an assignee or due date yet.",
        "During refinement, open each item to sharpen the title, add acceptance criteria as a checklist in the description, and set a priority or label. Use Filter to review by priority, label, assignee, or custom field. If your team estimates, a number custom field holds the size.",
        "When an item is ready, change its status to a board column such as To Do and it joins the active work. To send something back, right-click its card and choose Mark as planned.",
      ],
    },
  ],
  faq: [
    {
      question: "Is backlog grooming the same as backlog refinement?",
      answer:
        "Yes. The Scrum Guide calls it product backlog refinement, and many teams have moved to that name. The activity is the same.",
    },
    {
      question: "How long should backlog refinement take?",
      answer:
        "Often 30 to 60 minutes a week for a small team. The Scrum Guide's older advice was to spend no more than about 10% of the team's capacity on it.",
    },
    {
      question:
        "What is the difference between refinement and sprint planning?",
      answer:
        "Refinement prepares future work so it is ready. Sprint planning picks which ready work the team commits to next. Good refinement makes planning short.",
    },
    {
      question: "Do kanban teams groom the backlog?",
      answer:
        "Yes. Without sprints they often refine continuously or in a short weekly session, so there is always ready work at the top when someone has capacity to pull it.",
    },
  ],
  related: [
    {
      label: "How to prioritize tasks",
      href: "/guides/how-to-prioritize-tasks",
    },
    { label: "What is kanban?", href: "/guides/what-is-kanban" },
    {
      label: "Definition of done checklist",
      href: "/guides/definition-of-done-checklist",
    },
    {
      label: "What is project planning?",
      href: "/guides/what-is-project-planning",
    },
  ],
  updatedOn: "2026-10-19",
};
