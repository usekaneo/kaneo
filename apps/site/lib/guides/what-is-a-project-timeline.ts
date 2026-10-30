import type { Guide } from "./types";

export const whatIsAProjectTimeline: Guide = {
  slug: "what-is-a-project-timeline",
  question: "What is a project timeline?",
  title: "What Is a Project Timeline? How to Make One",
  description:
    "What a project timeline is, how it differs from a schedule and a roadmap, a six-week example, and the steps to build one that survives contact with reality.",
  summary:
    "A project's work in date order: how to build one, an example, and how to keep it honest.",
  answer:
    "A project timeline is the project's work laid out in date order: what happens, when it starts, when it is due, and which pieces wait on others. It is usually drawn as a list of dated milestones or as a Gantt chart. To build one, list the work, estimate each piece, order it by dependency, place it on the calendar, and add buffer where a delay would spread.",
  sections: [
    {
      heading: "Timeline, schedule, and roadmap",
      table: {
        columns: ["", "Timeline", "Schedule", "Roadmap"],
        rows: [
          [
            "Answers",
            "When does each phase of this project happen?",
            "Who does which task on which dates?",
            "What will we build over the next quarters, and why?",
          ],
          [
            "Detail",
            "Phases and milestones",
            "Individual tasks with owners",
            "Themes and outcomes",
          ],
          [
            "Audience",
            "Stakeholders and the team",
            "The team doing the work",
            "Leadership, customers, the whole company",
          ],
          [
            "Changes",
            "When a milestone moves",
            "Weekly or daily",
            "Each planning cycle",
          ],
        ],
      },
    },
    {
      heading: "How to build a project timeline",
      items: [
        {
          name: "1. Start from the fixed dates",
          body: "Write down the dates that cannot move: a launch event, a contract end, a regulatory deadline. Everything else is arranged around them.",
        },
        {
          name: "2. List the work",
          body: "Use the task breakdown from your project plan. For a timeline you can group tasks into phases; keep the tasks underneath so you can check the phase lengths are real.",
          href: "/guides/what-is-project-planning",
        },
        {
          name: "3. Estimate durations",
          body: "Ask the people doing the work, and estimate in working days. Note where an estimate is a guess, because that is where your buffer should go.",
        },
        {
          name: "4. Order by dependency",
          body: "Find the tasks that cannot start until others finish. The longest chain of dependent tasks sets the earliest possible end date, which is called the critical path.",
          href: "/guides/what-is-a-gantt-chart",
        },
        {
          name: "5. Place it on the calendar",
          body: "Account for holidays, people's time off, and the other projects your team is on. A task that takes three days of work rarely finishes three calendar days after it starts.",
        },
        {
          name: "6. Mark milestones",
          body: "Add a few checkpoints where something visible is finished: design approved, beta live, launch. Milestones are what you report to people outside the team.",
        },
        {
          name: "7. Add buffer to the chain, not to every task",
          body: "Padding every task hides the buffer and it gets used up anyway. A single buffer before the deadline, on the critical path, is easier to protect and to talk about.",
        },
      ],
    },
    {
      heading: "Example: a six-week feature launch",
      table: {
        columns: ["Week", "Work", "Milestone"],
        rows: [
          ["1", "Research, write the spec, agree scope", "Spec approved"],
          ["2", "Design, start backend work in parallel", "Designs approved"],
          ["3", "Build backend and frontend", ""],
          [
            "4",
            "Finish build, write docs, internal testing",
            "Feature complete",
          ],
          ["5", "Beta with a few customers, fix issues", "Beta live"],
          [
            "6",
            "Buffer for fixes, then release and announce",
            "Generally available",
          ],
        ],
      },
    },
    {
      heading: "Keeping a timeline honest",
      body: [
        "Update it when something moves, on the day it moves. A timeline that is two weeks stale is worse than none, because people still make decisions from it.",
        "Watch the critical path, not the whole chart. A task with slack can slip a few days without consequence; a task on the critical path moves the end date with it.",
        "When a date slips, say what will change: the end date, the scope, or the people. Pretending the original date still holds only moves the bad news to later, when there are fewer options.",
      ],
    },
    {
      heading: "Building a timeline in Kaneo",
      body: [
        "Give each task a start date and a due date. In the Tasks view, open Display and choose Gantt to see the work as bars on a shared timeline, or Calendar to review it month by month. Search and filters apply to both, so you can look at one person's or one label's work.",
        "Drag a bar to move a task, or drag either end to change its start or due date. Record order with relations: mark a task as Blocks on the work that has to wait for it.",
        "Kaneo has no separate milestone type. A short task with a due date and a milestone label does the same job, and filtering by that label gives you the stakeholder view of the timeline.",
      ],
    },
  ],
  faq: [
    {
      question: "What should a project timeline include?",
      answer:
        "The main phases or tasks, their start and end dates, the dependencies between them, a few milestones, and the fixed deadline the project is working towards. For the team, add owners. For stakeholders, the milestones are often enough.",
    },
    {
      question: "How do you make a project timeline?",
      answer:
        "Start from fixed dates, list the work, estimate each piece, order it by dependency, place it on the calendar around holidays and other commitments, mark milestones, and add a buffer before the deadline.",
    },
    {
      question: "Is a Gantt chart the same as a timeline?",
      answer:
        "A Gantt chart is one way to draw a timeline: tasks as rows, bars across a calendar. A timeline can also be a simple dated list of milestones, which is often clearer for people outside the team.",
    },
    {
      question: "How detailed should a timeline be?",
      answer:
        "Detailed enough that each bar has an owner and a clear finish, and no more. For long projects, keep the near weeks detailed and the later months at the level of phases until they get closer.",
    },
  ],
  related: [
    { label: "Project milestones", href: "/guides/project-milestones" },
    { label: "What is a Gantt chart?", href: "/guides/what-is-a-gantt-chart" },
    {
      label: "What is project planning?",
      href: "/guides/what-is-project-planning",
    },
    { label: "What is project scope?", href: "/guides/what-is-project-scope" },
  ],
  updatedOn: "2026-10-19",
};
