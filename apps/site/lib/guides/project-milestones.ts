import type { Guide } from "./types";

export const projectMilestones: Guide = {
  slug: "project-milestones",
  question: "What are milestones in project management?",
  title: "Project Milestones: Examples and How to Track Them",
  description:
    "What a project milestone is, how it differs from a task and a deliverable, milestone examples for common projects, and how to set and track them.",
  summary:
    "What makes a good milestone, examples for common projects, and how to track them without a dedicated feature.",
  answer:
    "A milestone is a point in a project that marks a significant event, such as a phase finishing, a deliverable being approved, or a release going live. Unlike a task, it has no duration: it is a moment, not work. Milestones break a long project into checkpoints, give stakeholders a simple way to follow progress, and show early whether the end date is still realistic.",
  sections: [
    {
      heading: "Milestone, task, and deliverable",
      table: {
        columns: ["", "Milestone", "Task", "Deliverable"],
        rows: [
          [
            "What it is",
            "A point in time",
            "A piece of work",
            "A thing handed over",
          ],
          ["Duration", "None", "Hours to weeks", "Produced by tasks"],
          [
            "Example",
            "Design approved",
            "Create page layouts",
            "Approved page designs",
          ],
          ["Audience", "Stakeholders and team", "Team", "Client or next team"],
        ],
      },
    },
    {
      heading: "What makes a good milestone",
      items: [
        {
          name: "It is observable",
          body: 'Anyone can tell whether it happened. "Beta live with 20 customers" is observable; "backend mostly done" is not.',
        },
        {
          name: "It marks a decision or handover",
          body: "Sign-offs, launches, and the end of a phase make good milestones, because something changes when they are reached.",
        },
        {
          name: "There are few of them",
          body: "Four to eight for a project of a few months. A milestone every week is just a task list with diamonds.",
        },
        {
          name: "It has a date and an owner",
          body: "Someone is responsible for it being reached on time and for raising the alarm early if it will not be.",
        },
      ],
    },
    {
      heading: "Milestone examples",
      items: [
        {
          name: "Software release",
          body: "Spec approved, feature complete, beta live, release candidate signed off, generally available.",
        },
        {
          name: "Website redesign",
          body: "Sitemap and wireframes approved, designs approved, content complete, site built on staging, launched.",
        },
        {
          name: "System migration",
          body: "Migration plan approved, test migration complete, user acceptance signed off, cutover done, old system decommissioned.",
        },
        {
          name: "Event",
          body: "Venue booked, speakers confirmed, registration open, final agenda published, event day.",
        },
      ],
    },
    {
      heading: "Tracking milestones",
      body: [
        "Put milestones on the project timeline and review them weekly. The useful question is not whether the next milestone is on time, but whether the work leading to it is: by the time a milestone is visibly late, the slip has usually been building for weeks.",
        "When a milestone moves, say what it moves: later milestones, the end date, or the scope. A milestone that quietly slides teaches people to ignore the others.",
        "Some teams use milestone trend analysis for this: each week, record the forecast date for every milestone, and chart the forecasts over time. Lines that keep rising show a schedule that is slipping long before the deadline.",
      ],
      items: [
        {
          name: "What is a project timeline?",
          body: "How to lay out work and milestones by date.",
          href: "/guides/what-is-a-project-timeline",
        },
      ],
    },
    {
      heading: "Milestones in Kaneo",
      body: [
        "Kaneo has no separate milestone type. Create a short task for each milestone with a due date and a milestone label, and it appears on the Gantt and Calendar views alongside the work leading up to it. Filter by the label to get the milestone-only view for stakeholders.",
        "Mark the tasks that must finish first with a Blocks relation to the milestone task, so anyone opening it can see what it is waiting on. When the milestone is reached, move it to Done like any other task.",
      ],
    },
  ],
  faq: [
    {
      question: "How many milestones should a project have?",
      answer:
        "Enough to give a checkpoint every few weeks: typically four to eight for a project of a few months. More than that and they lose their meaning.",
    },
    {
      question: "Do milestones have a duration?",
      answer:
        "No. A milestone is a point in time. In a Gantt chart it is usually shown as a diamond or a zero-length bar.",
    },
    {
      question: "What is the difference between a milestone and a goal?",
      answer:
        "A goal is the outcome the project is for. Milestones are checkpoints on the way to it.",
    },
    {
      question: "Should milestones be tied to payments?",
      answer:
        "Often, in client and contract work. Payment milestones need clear acceptance criteria, so both sides agree when one has been reached.",
    },
  ],
  related: [
    {
      label: "What is a project timeline?",
      href: "/guides/what-is-a-project-timeline",
    },
    { label: "What is a Gantt chart?", href: "/guides/what-is-a-gantt-chart" },
    { label: "Project life cycle", href: "/guides/project-life-cycle" },
  ],
  updatedOn: "2026-10-19",
};
