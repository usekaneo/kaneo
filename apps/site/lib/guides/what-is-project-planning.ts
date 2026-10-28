import type { Guide } from "./types";

export const whatIsProjectPlanning: Guide = {
  slug: "what-is-project-planning",
  question: "What is project planning?",
  title: "What Is Project Planning? Steps and Examples",
  description:
    "Project planning explained: what a plan contains, seven steps to write one, how much planning is enough, and how to turn the plan into tracked work.",
  summary:
    "What goes into a project plan, how to write one in an afternoon, and when to stop planning.",
  answer:
    "Project planning is deciding what a project will deliver, what has to happen to get there, who does each part, and roughly when. A useful plan names the goal, the scope, the tasks and their order, the owners, and the few dates that actually matter. It is a working document, not a prediction: its job is to surface trade-offs early, while they are still cheap to make.",
  sections: [
    {
      heading: "What a project plan contains",
      items: [
        {
          name: "A goal",
          body: 'One sentence that says what is different when the project is finished. "Customers can pay annually" is a goal. "Billing improvements" is a topic.',
        },
        {
          name: "Scope",
          body: "The deliverables, and a short list of what is deliberately left out. The out-of-scope list prevents more arguments than anything else in the plan.",
          href: "/guides/what-is-project-scope",
        },
        {
          name: "Tasks",
          body: "The work broken down far enough that each piece has one owner and fits in a few days. Bigger pieces hide unknowns.",
        },
        {
          name: "Order and dependencies",
          body: "Which tasks must finish before others can start. This, more than the estimates, decides how long the project takes.",
        },
        {
          name: "Owners",
          body: "A name on every task. Shared ownership usually means nobody notices when the task stalls.",
        },
        {
          name: "Schedule",
          body: "Start and due dates for the work that has a real deadline, laid out as a timeline so overlaps and gaps are visible.",
          href: "/guides/what-is-a-project-timeline",
        },
        {
          name: "Risks",
          body: "The three or four things most likely to go wrong, and what you will do if they do. Writing them down is most of the value.",
        },
      ],
    },
    {
      heading: "How to plan a project in seven steps",
      items: [
        {
          name: "1. Write the goal and who it is for",
          body: "If two people on the team describe the goal differently, stop and settle that first. Every later step depends on it.",
        },
        {
          name: "2. List the deliverables and the exclusions",
          body: "Write what the project produces, then what it will not. Share both with whoever asked for the project before any work starts.",
        },
        {
          name: "3. Break the deliverables into tasks",
          body: "Keep splitting until each task has an obvious first step and one owner. A list of thirty small tasks is easier to schedule than eight large ones.",
        },
        {
          name: "4. Mark what blocks what",
          body: "Go through the list once and note which tasks cannot start until another finishes. Most tasks have no dependency at all; the few that do are what you plan around.",
        },
        {
          name: "5. Estimate, then add buffer",
          body: "Ask the person doing the work, not the person who wants it done. Add buffer to the chain of dependent tasks rather than padding every task equally.",
        },
        {
          name: "6. Put it on a timeline",
          body: "Give dated work a start and due date and look at it on a Gantt chart. This is where you find the week where one person has four things due.",
          href: "/guides/what-is-a-gantt-chart",
        },
        {
          name: "7. Agree how you will track it",
          body: "Decide where the plan lives, how status is updated, and when you will review it. A plan nobody looks at after kickoff is a document, not a plan.",
        },
      ],
    },
    {
      heading: "How much planning is enough",
      body: [
        "Plan in detail only as far as you can see. The next two to four weeks deserve real tasks, owners, and dates. Work further out can stay as a rough list until it gets closer, because by then you will know more about it.",
        "Small projects need a goal, a task list, and owners. Add a timeline when there is a fixed date or several people whose work overlaps. Add a risk list when being late would be expensive.",
        "Agile teams still plan. They plan in shorter loops, re-plan at the end of each one, and keep the backlog as the long-range plan. The questions are the same: what are we delivering, in what order, and who is doing it.",
      ],
    },
    {
      heading: "Common planning mistakes",
      body: [
        "Planning the work nobody understands yet in the same detail as the work everyone does. Put a short spike task in front of the unknown part instead, and plan the rest once it is done.",
        "Treating the first plan as a commitment. When something changes, update the plan the same day and say what moved, rather than letting the plan and reality drift apart.",
        "Planning alone. The people doing the work spot missing tasks and bad estimates in minutes. A plan they did not see is a plan they do not own.",
      ],
    },
    {
      heading: "Planning a project in Kaneo",
      body: [
        "Create a project and put everything you have into its Backlog first: choose Plan, add a title, and set a priority or label where it helps. Ideas do not need an owner or a date to be worth keeping, and the backlog stays out of the way of the active board.",
        "Write the goal and the out-of-scope list in the project description under project settings, so everyone sees the same boundary.",
        "Break larger pieces into subtasks, each with its own assignee and status. Record order with relations: mark a task as Blocks on the work that has to wait for it, and the other task shows it as blocked by.",
        "Give dated work a start and due date, then open Display and switch the Tasks view to Gantt to see the schedule. Drag a bar to move a task, or drag its ends to change the dates. When a task is ready to start, change its status to a board column and it joins the active work.",
      ],
    },
  ],
  faq: [
    {
      question: "What is the difference between a project plan and a schedule?",
      answer:
        "The plan covers what, why, who, and in what order. The schedule is the part of the plan that puts tasks on dates. You can have a plan without a detailed schedule for small projects, but a schedule without a plan behind it is just a list of dates.",
    },
    {
      question: "Who is responsible for project planning?",
      answer:
        "Usually a project manager, team lead, or product owner drives it, but the people doing the work should write the task breakdown and the estimates. The person driving the plan owns keeping it current.",
    },
    {
      question: "How long should project planning take?",
      answer:
        "For a project of a few weeks with a small team, an afternoon is usually enough for the first version. Spend more time when the cost of being wrong is high, and less when you can cheaply change course once work starts.",
    },
    {
      question: "What are the main phases of a project?",
      answer:
        "The common breakdown is initiation, planning, execution, monitoring, and closure. In practice planning and execution overlap: you plan the next stretch of work while the current one is underway.",
    },
    {
      question: "Do I need special software to plan a project?",
      answer:
        "Not to start. A document and a shared board will do. Software helps once you need dates, dependencies, and status in one place that everyone can see. Kaneo covers that with a backlog, board, and Gantt view, and it is free to self-host.",
    },
  ],
  related: [
    { label: "Project charter", href: "/guides/project-charter" },
    { label: "What is project scope?", href: "/guides/what-is-project-scope" },
    {
      label: "What is a project timeline?",
      href: "/guides/what-is-a-project-timeline",
    },
    { label: "What is a Gantt chart?", href: "/guides/what-is-a-gantt-chart" },
    {
      label: "Best project management tools for small teams",
      href: "/guides/project-management-for-small-teams",
    },
  ],
  updatedOn: "2026-10-19",
};
