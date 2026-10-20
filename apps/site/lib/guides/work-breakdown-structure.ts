import type { Guide } from "./types";

export const workBreakdownStructure: Guide = {
  slug: "work-breakdown-structure",
  question: "What is a work breakdown structure?",
  title: "Work Breakdown Structure (WBS): Examples and Steps",
  description:
    "What a work breakdown structure is, a worked WBS example, the 100% rule, how deep to break work down, and how a WBS maps onto tasks and subtasks.",
  summary:
    "Breaking a project into deliverables and work packages, with a worked example and the rules that keep it useful.",
  answer:
    "A work breakdown structure (WBS) splits a project into its deliverables, then splits each deliverable into smaller pieces of work, level by level, until every piece can be estimated, assigned to one owner, and tracked. It is organised by what gets delivered, not by when or by whom. The lowest level, the work package, is what ends up on the schedule and the board.",
  sections: [
    {
      heading: "A worked example",
      body: [
        "Take a project to launch a new company website. The top level is the project. The second level is the deliverables. Below each deliverable are the work packages that produce it.",
      ],
      table: {
        columns: ["Code", "Element", "Level"],
        rows: [
          ["1", "New company website", "Project"],
          ["1.1", "Content", "Deliverable"],
          ["1.1.1", "Page copy for home, pricing, about", "Work package"],
          ["1.1.2", "Product screenshots", "Work package"],
          ["1.2", "Design", "Deliverable"],
          ["1.2.1", "Page layouts", "Work package"],
          ["1.2.2", "Component library", "Work package"],
          ["1.3", "Build", "Deliverable"],
          ["1.3.1", "Templates and components", "Work package"],
          ["1.3.2", "Contact form and analytics", "Work package"],
          ["1.4", "Launch", "Deliverable"],
          ["1.4.1", "Redirects from old URLs", "Work package"],
          ["1.4.2", "Accessibility and speed checks", "Work package"],
        ],
      },
    },
    {
      heading: "The rules that keep a WBS useful",
      items: [
        {
          name: "The 100% rule",
          body: "The children of each element add up to all of the work in the parent, no more and no less. If testing, migration, or launch work is missing from the breakdown, it is missing from the estimate too.",
        },
        {
          name: "Deliverables, not activities",
          body: 'Name the upper levels after outcomes ("Contact form") rather than verbs ("Coding"). Activities belong in the tasks inside a work package.',
        },
        {
          name: "No overlap",
          body: "Each piece of work appears in exactly one place. Overlap means double counting in the estimate and two owners who each assume the other has it.",
        },
        {
          name: "Stop at a sensible size",
          body: "A common guide is that a work package should take between a day and two weeks for one person or a small group. Smaller than that and the WBS becomes a task list; larger and it hides unknowns.",
        },
      ],
    },
    {
      heading: "How to build one",
      items: [
        {
          name: "1. Start from the scope statement",
          body: "List the deliverables the project has agreed to produce. They become the second level.",
          href: "/guides/what-is-project-scope",
        },
        {
          name: "2. Decompose each deliverable",
          body: "Ask what has to exist for this deliverable to be done, and write those pieces underneath. Repeat until each piece can be estimated with reasonable confidence.",
        },
        {
          name: "3. Check against the 100% rule",
          body: "Walk each level and ask whether anything is missing. Project management, testing, and handover are the usual gaps.",
        },
        {
          name: "4. Number the elements",
          body: "Codes like 1.2.1 make it easy to refer to a piece of work in estimates, budgets, and conversations.",
        },
        {
          name: "5. Hand the work packages to the schedule",
          body: "Estimate each package, find the dependencies between them, and lay them out on a timeline.",
          href: "/guides/what-is-a-project-timeline",
        },
      ],
    },
    {
      heading: "WBS, task list, and schedule",
      body: [
        "A WBS answers what the project consists of. A task list answers what to do next. A schedule answers when. They build on each other: the work packages from the WBS are broken into tasks, and the tasks get dates on the schedule.",
        "A WBS dictionary is an optional companion document that describes each work package: what it includes, its acceptance criteria, its owner, and its estimate. Large or contracted projects use one; small teams usually put the same information in the task description.",
      ],
    },
    {
      heading: "A work breakdown structure in Kaneo",
      body: [
        "Kaneo has no dedicated WBS diagram, but the structure maps directly onto tasks and subtasks. Create a task for each deliverable and add its work packages as subtasks; each subtask has its own owner and status, and opening one shows a link back to its parent.",
        "Put the WBS code in the task title or a text custom field if you need to refer to it elsewhere, and use labels to tag each task with its deliverable so you can filter the board by it. Add start and due dates to the work packages to see them on the Gantt view.",
      ],
    },
  ],
  faq: [
    {
      question: "What are the levels of a work breakdown structure?",
      answer:
        "Usually three: the project, its deliverables, and the work packages under each deliverable. Large projects add more levels in between, such as phases or sub-deliverables, but most small projects need no more than three.",
    },
    {
      question: "What is a work package?",
      answer:
        "The lowest level of a WBS: a piece of work small enough to estimate, assign to one owner, and track to completion. It is usually broken into tasks once work starts.",
    },
    {
      question: "Is a WBS still useful for agile teams?",
      answer:
        "Yes, in a lighter form. Breaking an epic into stories and stories into tasks is a work breakdown structure in all but name. The 100% rule is still the quickest way to find work nobody planned for.",
    },
    {
      question: "Should a WBS be a diagram or a list?",
      answer:
        "Either. A tree diagram is easier to discuss in a workshop; an indented list with codes is easier to maintain and to copy into a tracker. The content matters more than the format.",
    },
  ],
  related: [
    {
      label: "What is project planning?",
      href: "/guides/what-is-project-planning",
    },
    { label: "What is project scope?", href: "/guides/what-is-project-scope" },
    {
      label: "Task dependencies in project management",
      href: "/guides/task-dependencies",
    },
  ],
  updatedOn: "2026-10-19",
};
