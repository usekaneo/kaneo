import type { Guide } from "./types";

export const criticalPathMethod: Guide = {
  slug: "critical-path-method",
  question: "What is the critical path method?",
  title: "Critical Path Method (CPM): Steps and Example",
  description:
    "The critical path method step by step: a worked seven-task example with forward and backward passes, float, and how to shorten a project that runs long.",
  summary:
    "A worked seven-task example with forward and backward passes, float, and ways to shorten the schedule.",
  answer:
    "The critical path method (CPM) finds the longest chain of dependent tasks through a project. That chain, the critical path, sets the shortest possible project duration: any delay on it delays the finish. Every other task has float, an amount it can slip without moving the end date. To find it, list the tasks with their durations and dependencies, calculate the earliest and latest start and finish for each, and look for the tasks with zero float.",
  sections: [
    {
      heading: "The steps",
      items: [
        {
          name: "1. List the tasks",
          body: "Use the work packages from your work breakdown structure.",
          href: "/guides/work-breakdown-structure",
        },
        {
          name: "2. Find the dependencies",
          body: "For each task, write which tasks must finish before it can start.",
          href: "/guides/task-dependencies",
        },
        {
          name: "3. Estimate durations",
          body: "In working days, from the people who will do the work.",
        },
        {
          name: "4. Forward pass",
          body: "From the start, calculate each task's earliest start (the latest earliest-finish of its predecessors) and earliest finish (earliest start plus duration).",
        },
        {
          name: "5. Backward pass",
          body: "From the end, calculate each task's latest finish (the earliest latest-start of the tasks that follow it) and latest start (latest finish minus duration).",
        },
        {
          name: "6. Calculate float",
          body: "Float is latest start minus earliest start. Tasks with zero float form the critical path.",
        },
      ],
    },
    {
      heading: "A worked example",
      body: [
        "A small product feature with seven tasks. Design and the database work can run in parallel after requirements; the build needs both; docs only need the design; launch needs testing and docs.",
      ],
      table: {
        columns: [
          "Task",
          "Days",
          "Depends on",
          "Early start",
          "Early finish",
          "Late start",
          "Late finish",
          "Float",
        ],
        rows: [
          ["A. Requirements", "3", "None", "0", "3", "0", "3", "0"],
          ["B. Design", "4", "A", "3", "7", "4", "8", "1"],
          ["C. Database", "5", "A", "3", "8", "3", "8", "0"],
          ["D. Build", "6", "B, C", "8", "14", "8", "14", "0"],
          ["E. Docs", "2", "B", "7", "9", "15", "17", "8"],
          ["F. Testing", "3", "D", "14", "17", "14", "17", "0"],
          ["G. Launch", "1", "E, F", "17", "18", "17", "18", "0"],
        ],
      },
    },
    {
      heading: "Reading the result",
      body: [
        "The critical path is A, C, D, F, G: requirements, database, build, testing, launch. It adds up to 18 days, so the project cannot finish sooner than that with these estimates.",
        "Design has one day of float: it can slip a day without consequence, but a second day pushes the build back. Docs have eight days of float, so they can wait for whoever is free. If you want to bring the launch forward, the database work is where to look, not the design.",
        "The critical path can change. If design slips two days, it becomes critical instead of the database. Recalculate when estimates change, not just at the start.",
      ],
    },
    {
      heading: "Shortening a project that runs long",
      items: [
        {
          name: "Fast-tracking",
          body: "Run critical tasks in parallel that were planned in sequence, such as starting the build on the parts of the design that are approved. Cheap, but adds the risk of rework.",
        },
        {
          name: "Crashing",
          body: "Add people or money to critical tasks. Works for work that splits cleanly; for most knowledge work, adding people late slows things down first.",
        },
        {
          name: "Cutting scope",
          body: "Remove or defer work on the critical path. Often the most effective option and the least popular.",
          href: "/guides/moscow-prioritization",
        },
        {
          name: "Breaking dependencies",
          body: "Many dependencies are habits rather than necessities. Mocking an API so the frontend can start early removes a dependency entirely.",
        },
      ],
    },
    {
      heading: "CPM, PERT, and critical chain",
      body: [
        "CPM uses one duration estimate per task. PERT uses three, optimistic, most likely, and pessimistic, and combines them to account for uncertainty. Critical chain project management also considers which people each task needs, and moves safety margins out of individual tasks into a shared buffer at the end of the chain.",
        "For most teams, CPM with honest estimates and a buffer before the deadline is enough.",
      ],
    },
    {
      heading: "Applying CPM in Kaneo",
      body: [
        "Kaneo does not calculate the critical path for you. Record each dependency with a Blocks relation on the task, so the order is visible on every task. Then work through the forward and backward passes as above, which takes minutes for a project of a few dozen tasks.",
        "Give each task start and due dates that follow the result and check them on the Gantt view, where you can drag bars to reschedule. A critical label on the zero-float tasks lets you filter the board to the work that decides the launch date.",
      ],
    },
  ],
  faq: [
    {
      question: "What is float in project management?",
      answer:
        "The time a task can be delayed without delaying the project. It is the difference between a task's latest and earliest start. Tasks on the critical path have zero float.",
    },
    {
      question: "Can a project have more than one critical path?",
      answer:
        "Yes. If two chains have the same total duration, both are critical, and a delay on either moves the end date. That makes the schedule riskier.",
    },
    {
      question: "Who invented the critical path method?",
      answer:
        "Morgan Walker of DuPont and James Kelley of Remington Rand developed it in the late 1950s to schedule plant maintenance and construction.",
    },
    {
      question: "Is the critical path the longest or shortest path?",
      answer:
        "The longest path of dependent tasks through the project. Its length is the shortest possible duration of the whole project.",
    },
  ],
  related: [
    { label: "What is a Gantt chart?", href: "/guides/what-is-a-gantt-chart" },
    {
      label: "Task dependencies in project management",
      href: "/guides/task-dependencies",
    },
    {
      label: "What is a project timeline?",
      href: "/guides/what-is-a-project-timeline",
    },
  ],
  updatedOn: "2026-10-19",
};
