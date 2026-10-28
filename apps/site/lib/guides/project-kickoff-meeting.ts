import type { Guide } from "./types";

export const projectKickoffMeeting: Guide = {
  slug: "project-kickoff-meeting",
  question: "How do you run a project kickoff meeting?",
  title: "Project Kickoff Meeting: Agenda and Checklist",
  description:
    "A 60-minute project kickoff meeting agenda, a preparation checklist, what to send afterwards, and how internal and client kickoffs differ.",
  summary:
    "A 60-minute agenda, what to prepare, and what to send afterwards so the meeting actually changes something.",
  answer:
    "A project kickoff meeting brings everyone involved together at the start of a project to agree on the goal, scope, roles, timeline, and ways of working. A good one takes about an hour, ends with every open question either answered or assigned, and is followed the same day by a written summary. Its real purpose is to surface disagreements while they are still cheap to resolve.",
  sections: [
    {
      heading: "A 60-minute agenda",
      table: {
        columns: ["Starts at", "Topic", "Purpose"],
        rows: [
          [
            "0:00",
            "Introductions",
            "Who is here and what each person will do on the project",
          ],
          [
            "0:05",
            "Why this project",
            "The sponsor explains the problem and what success looks like",
          ],
          [
            "0:15",
            "Scope",
            "Deliverables, and especially what is out of scope",
          ],
          [
            "0:25",
            "Timeline and milestones",
            "Key dates and what each depends on",
          ],
          [
            "0:35",
            "Roles and decisions",
            "Who does what, who signs off, who to ask",
          ],
          [
            "0:45",
            "Ways of working",
            "Where work is tracked, how status is shared, meeting rhythm",
          ],
          [
            "0:50",
            "Risks and open questions",
            "What could go wrong, what is still unknown",
          ],
          ["0:55", "Next steps", "Owners and dates for every open item"],
        ],
      },
    },
    {
      heading: "Before the meeting",
      items: [
        {
          name: "Draft the charter or brief",
          body: "Goal, scope, timeline, and roles written down in advance, so the meeting is about agreeing rather than inventing.",
          href: "/guides/project-charter",
        },
        {
          name: "Draft a RACI",
          body: "Who is responsible, accountable, consulted, and informed for the main deliverables. Disagreements on this are best found now.",
          href: "/guides/raci-chart",
        },
        {
          name: "Set up the project space",
          body: "The board, backlog, and project description ready, with the first tasks in place, so you can show where work will live.",
        },
        {
          name: "Invite the right people",
          body: "Everyone who will do the work or sign it off. People who only need to be informed can read the summary.",
        },
        {
          name: "Send the agenda and draft a day ahead",
          body: "People who read it first ask better questions.",
        },
      ],
    },
    {
      heading: "After the meeting",
      body: [
        "Send a summary the same day: the agreed goal, scope, and exclusions, the milestone dates, who does what, the decisions made, and the open questions with an owner and a date for each. Link to where the work is tracked.",
        "Update the charter and the project with anything that changed. Then schedule the first check-in, so the plan is reviewed before it has a chance to drift.",
      ],
    },
    {
      heading: "Internal vs client kickoffs",
      body: [
        "An internal kickoff can be informal and focus on how the team will work. A client kickoff needs more structure: confirm the scope of work line by line, agree how feedback and approvals will happen and how quickly, name the single contact on each side, and explain how change requests are handled.",
        "In both cases, the most valuable minutes are spent on scope exclusions and on who makes the final call. Those are the two topics most likely to cause trouble later.",
      ],
      items: [
        {
          name: "Scope of work: template and example",
          body: "The document a client kickoff walks through.",
          href: "/guides/scope-of-work",
        },
      ],
    },
    {
      heading: "Setting up the project in Kaneo before kickoff",
      body: [
        "Create the project, write the charter or scope summary in the project description, and add the first deliverables and milestones as tasks with due dates, so the Gantt view shows the timeline you will present.",
        "Invite the team as members; limit contractors and client contacts to this project, with the Viewer role for anyone who only needs to follow along. Share the board on screen during the meeting, and add the open questions as tasks with owners before everyone leaves.",
      ],
    },
  ],
  faq: [
    {
      question: "Who should attend a project kickoff meeting?",
      answer:
        "The sponsor, the project lead, everyone who will do significant work on the project, and the key stakeholders who will sign off deliverables. For client projects, the client's decision-maker and main contact.",
    },
    {
      question: "How long should a kickoff meeting be?",
      answer:
        "About an hour for most projects. Large or multi-team projects may need a half-day workshop, but most of the value comes from the first hour.",
    },
    {
      question:
        "What is the difference between a kickoff meeting and a project initiation?",
      answer:
        "Initiation is the phase where the project is defined and approved. The kickoff meeting comes at the start of execution, once the project is approved, to align the people doing the work.",
    },
    {
      question: "Do small projects need a kickoff meeting?",
      answer:
        "A short one, yes. Even fifteen minutes to agree on the goal, the scope, and who decides saves time later.",
    },
  ],
  related: [
    { label: "Project charter", href: "/guides/project-charter" },
    { label: "RACI chart", href: "/guides/raci-chart" },
    { label: "Project life cycle", href: "/guides/project-life-cycle" },
  ],
  updatedOn: "2026-10-19",
};
