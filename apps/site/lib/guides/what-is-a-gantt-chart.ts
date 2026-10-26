import type { Guide } from "./types";

export const whatIsAGanttChart: Guide = {
  slug: "what-is-a-gantt-chart",
  question: "What is a Gantt chart?",
  title: "What Is a Gantt Chart? How to Read and Build One",
  description:
    "How to read a Gantt chart, the critical path worked through step by step, when a Gantt chart helps and when a board is better, and how to build one.",
  summary:
    "Reading the bars, finding the critical path, and knowing when a board does the job better.",
  answer:
    "A Gantt chart is a bar chart of a project's schedule. Each task is a row, and a horizontal bar shows when it starts and ends against a calendar along the top. It shows at a glance what is happening this week, what overlaps, and how the work leads up to a deadline. Many Gantt tools also draw dependencies between bars and highlight the critical path: the chain of tasks that sets the earliest possible finish date.",
  sections: [
    {
      heading: "How to read a Gantt chart",
      items: [
        {
          name: "Rows",
          body: "One task per row, often grouped by phase or owner. Read down the left edge to see what the project consists of.",
        },
        {
          name: "Bars",
          body: "The left end is the start date and the right end is the due date. A longer bar is a longer span on the calendar, not necessarily more effort.",
        },
        {
          name: "The time axis",
          body: "Days, weeks, or months along the top. A vertical line usually marks today, so anything entirely left of it should be finished.",
        },
        {
          name: "Overlaps",
          body: "Bars stacked in the same weeks run in parallel. Several overlapping bars with the same owner are the first thing to look for.",
        },
        {
          name: "Dependencies",
          body: "Arrows from the end of one bar to the start of another, where the tool draws them, mean the second task waits for the first.",
        },
        {
          name: "Milestones",
          body: "Often shown as diamonds or zero-length bars: a moment when something is finished, such as beta live or design approved.",
        },
      ],
    },
    {
      heading: "The critical path, worked through",
      body: [
        "The critical path is the longest chain of dependent tasks from the start of the project to the end. Its length is the shortest time the project can take. Any delay on it delays the finish; tasks off it have slack, time they can slip without moving the end date.",
        "Take a small feature with five tasks. Design comes first. Backend, frontend, and docs can all start once design is done. The launch review needs all three finished.",
      ],
      table: {
        columns: ["Task", "Takes", "Waits for", "Earliest finish", "Slack"],
        rows: [
          ["Design", "5 days", "Nothing", "Day 5", "None"],
          ["Backend", "10 days", "Design", "Day 15", "None"],
          ["Frontend", "6 days", "Design", "Day 11", "4 days"],
          ["Docs", "3 days", "Design", "Day 8", "7 days"],
          [
            "Launch review",
            "2 days",
            "Backend, frontend, docs",
            "Day 17",
            "None",
          ],
        ],
      },
    },
    {
      heading: "Reading the example",
      body: [
        "The review cannot start until day 15, when the backend finishes, so the project takes 17 days. Design, backend, and review are the critical path. Frontend could slip four days and docs seven without changing the launch date.",
        "That tells you where attention pays off. Adding a second person to the frontend saves nothing. Splitting the backend so part of it starts during design, or starting the review on the finished parts early, is what actually shortens the project.",
        "It also tells you where the risk is. If the backend estimate is the shakiest in the plan, the launch date is only as reliable as that estimate.",
      ],
    },
    {
      heading: "When a Gantt chart helps, and when it does not",
      body: [
        "Use a Gantt chart when there is a fixed date, several people whose work depends on each other, or stakeholders who need to see how the pieces line up. Launches, migrations, events, and client projects with a delivery date are good fits.",
        "A board is better for continuous work without a fixed end, such as a support queue or ongoing product development. There the question is what to do next, not when everything finishes, and a chart full of rescheduled bars adds upkeep without adding information.",
        "Most teams use both: the board for day-to-day status and the Gantt chart for the few projects with a deadline. Status and dates answer different questions, so reaching a due date does not mean a task is done.",
      ],
    },
    {
      heading: "How to build a Gantt chart",
      body: [
        "List the tasks, estimate each one, and note which tasks wait for others. Give each task a start date and a due date, starting from the tasks with no dependencies and working forward. Then check the result for the obvious problems: one person with three overlapping bars, a dependency that starts before its predecessor ends, or no room before the deadline.",
        "Keep the chart at a level of detail you will actually maintain. Twenty bars that are current are worth more than two hundred that were accurate on the day you drew them.",
      ],
    },
    {
      heading: "Gantt charts in Kaneo",
      body: [
        "Every Kaneo project has a Gantt view. In the Tasks view, open Display and choose Gantt. Tasks with a start date, a due date, or both appear on a shared timeline, and the project's search and filters apply, so you can show one assignee's or one label's work.",
        "Drag a bar to move a task, or drag either end to change its start or due date. Scheduled tasks in the backlog are included, so you can lay out upcoming work before it reaches the board.",
        "Kaneo's Gantt view does not draw dependency lines or calculate the critical path. Record order with Blocks relations on each task and work out the path as in the example above. If you need automatic scheduling, baselines, and cost tracking, a heavier tool such as OpenProject is a better fit.",
      ],
    },
  ],
  faq: [
    {
      question: "What is a Gantt chart used for?",
      answer:
        "Planning and communicating a project schedule: what happens when, what runs in parallel, what depends on what, and whether the work fits before the deadline.",
    },
    {
      question: "What is the difference between a Gantt chart and a timeline?",
      answer:
        "A Gantt chart is a detailed kind of timeline, with one bar per task. A timeline can be simpler, such as a dated list of milestones. Teams often use the Gantt chart internally and a milestone timeline for stakeholders.",
    },
    {
      question: "What is slack or float in a Gantt chart?",
      answer:
        "The amount of time a task can slip without delaying the project end date. Tasks on the critical path have none. In the example above, docs have seven days of slack.",
    },
    {
      question: "Why is it called a Gantt chart?",
      answer:
        "After Henry Gantt, an American engineer who popularised the format in the 1910s for planning factory and construction work.",
    },
    {
      question: "Is there a free Gantt chart tool?",
      answer:
        "Yes. Kaneo includes a Gantt view in every project and is free to self-host under the MIT license. OpenProject's Community edition and spreadsheet templates are other free options.",
    },
  ],
  related: [
    {
      label: "Critical path method, step by step",
      href: "/guides/critical-path-method",
    },
    {
      label: "What is a project timeline?",
      href: "/guides/what-is-a-project-timeline",
    },
    {
      label: "What is project planning?",
      href: "/guides/what-is-project-planning",
    },
    { label: "Kaneo vs OpenProject", href: "/openproject-alternative" },
  ],
  updatedOn: "2026-10-19",
};
