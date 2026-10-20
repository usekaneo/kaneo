import type { Guide } from "./types";

export const taskDependencies: Guide = {
  slug: "task-dependencies",
  question: "What are task dependencies in project management?",
  title: "Task Dependencies in Project Management: 4 Types",
  description:
    "The four types of task dependency with examples, internal vs external dependencies, lead and lag time, and how to stop dependencies from stalling a project.",
  summary:
    "The four dependency types, the ones that cause real delays, and how to keep them visible.",
  answer:
    "A task dependency is a relationship where one task cannot start or finish until another task does. The most common is finish-to-start: the second task begins only after the first is done. Dependencies decide the order of work and, through the critical path, the earliest date a project can finish, so tracking them is what turns a task list into a schedule.",
  sections: [
    {
      heading: "The four types",
      table: {
        columns: ["Type", "Meaning", "Example"],
        rows: [
          [
            "Finish-to-start",
            "B starts after A finishes",
            "Write the copy, then build the page that uses it",
          ],
          [
            "Start-to-start",
            "B starts after A starts",
            "Testing starts once development has started on the first feature",
          ],
          [
            "Finish-to-finish",
            "B finishes after A finishes",
            "Documentation cannot be final until the feature is final",
          ],
          [
            "Start-to-finish",
            "B finishes after A starts",
            "The old system stays on until the new one goes live",
          ],
        ],
      },
    },
    {
      heading: "Which ones matter in practice",
      body: [
        "Finish-to-start covers the vast majority of real dependencies, and most teams only ever track that one. Start-to-start and finish-to-finish show up in parallel work such as testing alongside development. Start-to-finish is rare outside handovers and shift work.",
        "If you are unsure which type a dependency is, model it as finish-to-start. It is the most conservative and the easiest for everyone to understand.",
      ],
    },
    {
      heading: "Other ways to classify dependencies",
      items: [
        {
          name: "Internal or external",
          body: "Internal dependencies sit inside the team and you control them. External ones depend on another team, a vendor, or a client, and are the ones that cause most surprise delays.",
        },
        {
          name: "Mandatory or discretionary",
          body: "Mandatory dependencies are physical or legal: you cannot test code that does not exist. Discretionary ones are choices, such as finishing design before any build starts, and can be relaxed to save time.",
        },
        {
          name: "Resource dependencies",
          body: "Two tasks that could run in parallel but need the same person. They look independent on paper and are not.",
        },
      ],
    },
    {
      heading: "Lead and lag",
      body: [
        "Lag is a required wait between dependent tasks: concrete has to cure for a week before building on it, or a legal review needs five working days after submission. Lead is the opposite, an overlap where the second task starts before the first is fully done, such as starting frontend work once the API design is agreed rather than when the API is finished.",
        "Using lead deliberately is one of the few ways to shorten a schedule without adding people. It works best on discretionary dependencies.",
      ],
    },
    {
      heading: "Keeping dependencies from stalling work",
      items: [
        {
          name: "Find them during planning",
          body: "Walk the task list once and ask, for each task, what it waits for. It takes minutes and prevents the most common late surprise.",
          href: "/guides/what-is-project-planning",
        },
        {
          name: "Schedule the critical chain first",
          body: "The longest chain of dependent tasks sets the finish date. Give it your most reliable people and its own buffer.",
          href: "/guides/what-is-a-gantt-chart",
        },
        {
          name: "Chase external dependencies early",
          body: "Ask the other team or vendor for a date as soon as you know you depend on them, and check in before it is due, not after.",
        },
        {
          name: "Make blocked work visible",
          body: "A task waiting on something should say so where everyone looks. Silent blocks are how a two-day wait becomes two weeks.",
        },
      ],
    },
    {
      heading: "Tracking dependencies in Kaneo",
      body: [
        "Open a task's Relations and choose Blocks to link it to work that has to wait for it. The other task shows the inverse, blocked by, so whoever picks it up sees what it waits on. Choose Related for a connection that is not a dependency, and Remove relation to unlink tasks without deleting either.",
        "Give dependent tasks start and due dates and check the order on the Gantt view, where you can drag bars to reschedule. Kaneo tracks finish-to-start style blocking; it does not model lead and lag or draw dependency lines on the chart.",
      ],
    },
  ],
  faq: [
    {
      question: "What is the most common type of task dependency?",
      answer:
        "Finish-to-start, where one task must be complete before the next can begin. Most project tools default to it, and many only support it.",
    },
    {
      question: "What is the difference between a dependency and a constraint?",
      answer:
        "A dependency links two tasks. A constraint limits a task on its own, such as a fixed date it must start on or finish by. Both affect the schedule, but only dependencies create chains.",
    },
    {
      question: "How do dependencies relate to the critical path?",
      answer:
        "The critical path is the longest chain of dependent tasks through the project. Without dependencies every task could run in parallel and there would be no chain to find.",
    },
    {
      question: "What does blocked by mean on a task?",
      answer:
        "That the task is waiting for another task to be finished before it can proceed. It is the inverse of a blocks relationship.",
    },
  ],
  related: [
    { label: "Critical path method", href: "/guides/critical-path-method" },
    { label: "What is a Gantt chart?", href: "/guides/what-is-a-gantt-chart" },
    {
      label: "What is a project timeline?",
      href: "/guides/what-is-a-project-timeline",
    },
    {
      label: "Work breakdown structure",
      href: "/guides/work-breakdown-structure",
    },
  ],
  updatedOn: "2026-10-19",
};
