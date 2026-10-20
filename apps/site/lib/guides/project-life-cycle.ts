import type { Guide } from "./types";

export const projectLifeCycle: Guide = {
  slug: "project-life-cycle",
  question: "What are the phases of the project life cycle?",
  title: "Project Life Cycle: The 5 Phases Explained",
  description:
    "The five phases of the project management life cycle, what happens and what comes out of each, how agile changes it, and the mistakes made at each stage.",
  summary:
    "Initiation, planning, execution, monitoring, and closure: what each phase produces and where projects go wrong.",
  answer:
    "The project life cycle is the sequence of phases a project moves through from idea to finish. The common model has five: initiation, where the project is defined and approved; planning, where scope, schedule, and owners are worked out; execution, where the work is done; monitoring and control, which runs alongside execution to keep it on track; and closure, where results are handed over and lessons recorded.",
  sections: [
    {
      heading: "The five phases at a glance",
      table: {
        columns: ["Phase", "Key question", "Main output"],
        rows: [
          [
            "1. Initiation",
            "Should we do this, and who leads it?",
            "Project charter",
          ],
          [
            "2. Planning",
            "What exactly, in what order, by whom, by when?",
            "Project plan, scope, timeline",
          ],
          ["3. Execution", "Are we building the right thing?", "Deliverables"],
          [
            "4. Monitoring and control",
            "Are we on track, and what do we change?",
            "Status updates, change decisions",
          ],
          [
            "5. Closure",
            "Is it accepted, and what did we learn?",
            "Handover, retrospective, archived project",
          ],
        ],
      },
    },
    {
      heading: "1. Initiation",
      body: [
        "The project is proposed, its purpose and expected value are stated, and a sponsor approves it. The output is usually a project charter: a page that says why, what roughly, who leads, and what success looks like.",
        "The common mistake is skipping it. A project that starts without an agreed purpose and sponsor will relitigate both at the first difficult decision.",
      ],
      items: [
        {
          name: "Project charter: template and example",
          body: "What to put on the one page that starts a project.",
          href: "/guides/project-charter",
        },
      ],
    },
    {
      heading: "2. Planning",
      body: [
        "The team defines the scope in detail, breaks it into work, estimates it, orders it by dependency, and puts it on a timeline with owners. Risks and the communication plan are agreed, and a kickoff meeting gets everyone on the same page.",
        "Plan in detail only as far ahead as you can see. Over-planning distant work is as costly as under-planning the next few weeks.",
      ],
      items: [
        {
          name: "What is project planning?",
          body: "What a plan contains and seven steps to write one.",
          href: "/guides/what-is-project-planning",
        },
      ],
    },
    {
      heading: "3. Execution",
      body: [
        "The team does the work and produces the deliverables. Most of the time and money is spent here. The project lead's job shifts to removing blockers, coordinating dependencies, and protecting the team from unplanned work.",
        "Status should come from the work itself, a board people actually update, rather than from separate status meetings.",
      ],
    },
    {
      heading: "4. Monitoring and control",
      body: [
        "Runs in parallel with execution. Progress is compared against the plan, risks are watched, and changes to scope, time, or budget are decided deliberately rather than by drift. Milestones are the natural checkpoints.",
        "The most useful habit is a short weekly review: what moved, what is blocked, what changed, and whether the end date still holds.",
      ],
    },
    {
      heading: "5. Closure",
      body: [
        "Deliverables are formally accepted, the work is handed over to whoever runs it next, contracts are closed, and the team holds a retrospective. The project is archived so its history is searchable.",
        "Closure is the phase most often skipped, and the cost shows up later: unclear ownership of what was built, and the same mistakes in the next project.",
      ],
    },
    {
      heading: "Agile and the life cycle",
      body: [
        "Agile projects go through the same phases, but planning, execution, and monitoring repeat in short cycles instead of once. Initiation and closure still happen once per project or product release. Many teams use a hybrid: a planned timeline with fixed milestones, and agile iterations inside each phase.",
      ],
    },
    {
      heading: "The life cycle in Kaneo",
      body: [
        "Write the charter in the project description at initiation. During planning, capture work in the Backlog, break it into subtasks, add Blocks relations and dates, and check the schedule on the Gantt view.",
        "Execution and monitoring happen on the board: columns show status, filters by due date and priority show what is late or urgent, and repository automations move tasks as pull requests merge. At closure, archive completed tasks in bulk so the board is clean and the history stays searchable.",
      ],
    },
  ],
  faq: [
    {
      question: "What are the 5 phases of a project?",
      answer:
        "Initiation, planning, execution, monitoring and control, and closure. Some models merge monitoring into execution and describe four phases.",
    },
    {
      question:
        "What is the difference between the project life cycle and the product life cycle?",
      answer:
        "A project life cycle ends when the project's deliverables are handed over. A product life cycle covers the product's whole life, from introduction and growth to maturity and decline, and may contain many projects.",
    },
    {
      question: "Which phase is the most important?",
      answer:
        "Planning has the most leverage, because mistakes there are cheapest to fix. Closure is the most often neglected, and skipping it means losing what the project taught you.",
    },
    {
      question: "Is the software development life cycle the same thing?",
      answer:
        "The SDLC is a life cycle specific to building software: requirements, design, implementation, testing, deployment, and maintenance. It fits inside the execution phase of a software project.",
    },
  ],
  related: [
    { label: "Project charter", href: "/guides/project-charter" },
    {
      label: "Project kickoff meeting",
      href: "/guides/project-kickoff-meeting",
    },
    { label: "Project milestones", href: "/guides/project-milestones" },
  ],
  updatedOn: "2026-10-19",
};
