import type { Guide } from "./types";

export const raciChart: Guide = {
  slug: "raci-chart",
  question: "What is a RACI chart?",
  title: "RACI Chart: Definition, Template, and Examples",
  description:
    "What a RACI chart is, what Responsible, Accountable, Consulted, and Informed mean, a filled-in example, the rules that keep it useful, and common variations.",
  summary:
    "Who does the work, who signs it off, who gets asked, and who gets told, with an example you can copy.",
  answer:
    "A RACI chart is a table that lists a project's tasks or decisions down one side and the people or roles across the top, and marks each cell with R, A, C, or I. Responsible is who does the work, Accountable is the one person who owns the outcome and signs it off, Consulted is who gives input before the work is done, and Informed is who is told afterwards. It removes the two most common sources of project friction: work nobody owns and decisions everybody thinks they own.",
  sections: [
    {
      heading: "The four roles",
      items: [
        {
          name: "R: Responsible",
          body: "Does the work. There can be several, but at least one for every task.",
        },
        {
          name: "A: Accountable",
          body: "Owns the result and has the final say. Exactly one per task. Often the same person as Responsible on small teams.",
        },
        {
          name: "C: Consulted",
          body: "Gives input before or during the work, in a two-way conversation. Keep this list short; every C is a meeting or a review.",
        },
        {
          name: "I: Informed",
          body: "Is told about progress or the outcome, one way. A status update or a notification is enough.",
        },
      ],
    },
    {
      heading: "An example: launching a new pricing page",
      table: {
        columns: [
          "Task",
          "Product lead",
          "Designer",
          "Engineer",
          "Marketing",
          "Finance",
        ],
        rows: [
          ["Set new prices", "A", "I", "I", "C", "R"],
          ["Write page copy", "A", "C", "I", "R", "C"],
          ["Design the page", "A", "R", "C", "C", "I"],
          ["Build and test", "C", "C", "R, A", "I", "I"],
          ["Update billing system", "I", "I", "R", "I", "A"],
          ["Announce the change", "C", "I", "I", "R, A", "I"],
        ],
      },
    },
    {
      heading: "Rules that keep a RACI chart honest",
      items: [
        {
          name: "One A per row",
          body: "Two accountable people means none. If two people insist, the decision has not been made yet.",
        },
        {
          name: "At least one R per row",
          body: "A task with an A and no R will be discovered undone the week it is due.",
        },
        {
          name: "Check each column",
          body: "A person with Rs everywhere is a bottleneck. A person with only Cs and Is may not need to be on the project at all.",
        },
        {
          name: "Fewer Cs",
          body: "Consulting everyone feels safe and slows everything. Ask who would genuinely change the outcome, and inform the rest.",
        },
        {
          name: "Agree it at kickoff",
          body: "Walk through the chart with everyone on it. Surprises about who signs off belong in week one, not at the final review.",
          href: "/guides/project-kickoff-meeting",
        },
      ],
    },
    {
      heading: "Variations",
      body: [
        "RASCI adds S for Support: people who help the Responsible person without owning the task. RACI-VS adds Verifier and Signatory for regulated work. DACI (Driver, Approver, Contributors, Informed) is used for decisions rather than tasks, with the Driver running the process and the Approver making the call.",
        "For a small team, plain RACI is enough. If the chart needs a legend to read, it is too complicated.",
      ],
    },
    {
      heading: "Using RACI with Kaneo",
      body: [
        "Keep the chart itself in the project description, where everyone on the project can read it. Each task's assignee is its Responsible person, so the board and My tasks already show who is doing what.",
        "For the Accountable person, add a text custom field called Accountable, or a dropdown with the names of the people who sign off, and filter by it before a review. Consulted people can be mentioned in comments when their input is needed; Informed people can be workspace members with the Viewer role, or follow along through the project's notifications in Slack, Discord, or another channel.",
      ],
    },
  ],
  faq: [
    {
      question: "What is the difference between responsible and accountable?",
      answer:
        "Responsible people do the work. The accountable person owns the outcome and signs it off. There can be several responsible people on a task but only one accountable person.",
    },
    {
      question: "Can one person be both responsible and accountable?",
      answer:
        "Yes, and on small teams that is common. Mark the cell R and A. What matters is that someone is accountable and that it is only one person.",
    },
    {
      question: "When should you use a RACI chart?",
      answer:
        "When several teams or departments work on one project, when sign-off is unclear, or when the same question about who decides keeps coming up. A team of four in one room rarely needs one.",
    },
    {
      question: "Should a RACI chart list people or roles?",
      answer:
        "Roles for templates and long-running processes, so the chart survives people changing jobs. Names for a specific project, so there is no doubt who to ask.",
    },
  ],
  related: [
    { label: "Project charter", href: "/guides/project-charter" },
    {
      label: "Project kickoff meeting agenda",
      href: "/guides/project-kickoff-meeting",
    },
    {
      label: "What is project planning?",
      href: "/guides/what-is-project-planning",
    },
  ],
  updatedOn: "2026-10-19",
};
