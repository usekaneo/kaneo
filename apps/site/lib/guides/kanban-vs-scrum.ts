import type { Guide } from "./types";

export const kanbanVsScrum: Guide = {
  slug: "kanban-vs-scrum",
  question: "Kanban vs scrum: what is the difference?",
  title: "Kanban vs Scrum: Differences and How to Choose",
  description:
    "Kanban vs scrum compared on cadence, roles, planning, change, and metrics, plus scrumban, and a simple way to decide which one fits your team's work.",
  summary:
    "Cadence, roles, change, and metrics side by side, with a quick test for picking one.",
  answer:
    "Scrum organises work into fixed-length sprints, usually two weeks, with set roles and ceremonies, and the team commits to a sprint goal up front. Kanban has no sprints or required roles: work flows continuously across a board and work-in-progress limits control how much is active. Scrum suits teams building towards planned increments; kanban suits teams with a steady stream of incoming work of varying size.",
  sections: [
    {
      heading: "Side by side",
      table: {
        columns: ["", "Scrum", "Kanban"],
        rows: [
          [
            "Cadence",
            "Fixed sprints, usually 1 to 4 weeks",
            "Continuous flow, no iterations",
          ],
          ["Roles", "Product owner, scrum master, developers", "None required"],
          [
            "Planning",
            "Sprint planning commits to a set of work",
            "Pull the next item when there is capacity",
          ],
          [
            "Change mid-cycle",
            "Avoided; new work waits for the next sprint",
            "Allowed; reorder the backlog any time",
          ],
          [
            "Limiting work",
            "Sprint scope limits the work",
            "WIP limits per column",
          ],
          [
            "Meetings",
            "Planning, daily scrum, review, retrospective",
            "None prescribed; most teams hold a standup and a regular review",
          ],
          [
            "Main metrics",
            "Velocity, sprint burndown",
            "Cycle time, throughput",
          ],
          ["Board", "Reset each sprint", "Persistent"],
        ],
      },
    },
    {
      heading: "When scrum fits better",
      body: [
        "Scrum works well when the team builds a product in planned increments and benefits from a regular rhythm: a goal for the next two weeks, a demo at the end, and a retrospective to improve. The fixed sprint protects the team from constant reprioritisation, and the ceremonies give a new or growing team structure.",
        "It struggles when much of the work is unplanned, such as support, operations, or bug reports, because that work does not wait for the next sprint.",
      ],
    },
    {
      heading: "When kanban fits better",
      body: [
        "Kanban works well when work arrives continuously and varies in size: support and operations teams, maintenance, content production, and small product teams that ship as soon as something is ready. Priorities can change daily without breaking a commitment, and there are fewer meetings to run.",
        "Its risk is the opposite of scrum's: without a cadence, nothing forces the team to stop and review. A short weekly review and an agreed WIP limit cover most of that.",
      ],
    },
    {
      heading: "Scrumban",
      body: [
        "Scrumban is the common middle ground: a persistent kanban board with WIP limits, combined with scrum's regular planning and retrospectives. Many teams that say they do scrum are closer to this, and it is often where scrum teams end up after a year of adjusting.",
      ],
    },
    {
      heading: "A quick way to decide",
      items: [
        {
          name: "Is most of your work planned weeks ahead?",
          body: "If yes, scrum's sprints add focus. If most work arrives during the week, kanban fits the reality.",
        },
        {
          name: "Do stakeholders need a regular demo?",
          body: "Sprint reviews give them one. Kanban teams can hold a review on a fixed day too, without the sprint commitment.",
        },
        {
          name: "Is the team new to working together?",
          body: "Scrum's roles and ceremonies give structure. Experienced teams often find kanban's lighter process enough.",
        },
        {
          name: "How often do priorities change?",
          body: "Weekly or more often favours kanban. A team that keeps breaking sprints is telling you something.",
        },
      ],
    },
    {
      heading: "Running either in Kaneo",
      body: [
        "Kaneo is built around a kanban board with a separate backlog, so kanban teams can use it as it comes: set the columns in the workflow settings, keep upcoming work in the Backlog, and pull it onto the board when someone has capacity.",
        "Kaneo has no built-in sprints, story points, or burndown charts. Teams running lightweight scrum use a label per sprint, a number custom field for estimates, and due dates for the sprint end, then filter the board by the current sprint's label. Teams that need velocity tracking and burndowns should pick a scrum-focused tool such as Taiga.",
      ],
    },
  ],
  faq: [
    {
      question: "Is kanban better than scrum?",
      answer:
        "Neither is better in general. Scrum suits planned, increment-based product work; kanban suits continuous, variable work. Pick the one that matches how work actually arrives for your team.",
    },
    {
      question: "Can you use kanban and scrum together?",
      answer:
        "Yes. Scrumban combines a kanban board and WIP limits with scrum's planning and retrospectives. Scrum teams also commonly use a kanban-style board to track work within a sprint.",
    },
    {
      question: "Does kanban have sprints?",
      answer:
        "No. Kanban uses continuous flow instead of fixed iterations. Teams may still hold reviews or releases on a regular schedule.",
    },
    {
      question: "Is kanban agile?",
      answer:
        "Yes. Both kanban and scrum are agile methods. Scrum is a framework with prescribed roles and events; kanban is a method for managing flow that fits around your existing process.",
    },
  ],
  related: [
    { label: "What is kanban?", href: "/guides/what-is-kanban" },
    { label: "Agile vs scrum", href: "/guides/agile-vs-scrum" },
    { label: "Backlog grooming", href: "/guides/backlog-grooming" },
    { label: "Kaneo vs Taiga", href: "/taiga-alternative" },
  ],
  updatedOn: "2026-10-19",
};
