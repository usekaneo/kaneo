import type { Guide } from "./types";

export const agileVsScrum: Guide = {
  slug: "agile-vs-scrum",
  question: "Agile vs scrum: what is the difference?",
  title: "Agile vs Scrum: What Is the Difference?",
  description:
    "Agile is a set of values and principles; scrum is one framework that puts them into practice. What each one is, how they compare, and where kanban fits.",
  summary:
    "Agile is the philosophy, scrum is one way to practise it. What that means day to day.",
  answer:
    "Agile is a set of values and principles for building software in small increments, with frequent feedback and room to change course, first written down in the 2001 Agile Manifesto. Scrum is one specific framework for working that way, with fixed-length sprints, three roles, and a defined set of events. All scrum is agile, but agile teams can also use kanban, extreme programming, or their own mix.",
  sections: [
    {
      heading: "Side by side",
      table: {
        columns: ["", "Agile", "Scrum"],
        rows: [
          [
            "What it is",
            "A philosophy: four values and twelve principles",
            "A framework with defined roles, events, and artefacts",
          ],
          [
            "Prescribes",
            "Nothing specific about process",
            "Sprints, sprint planning, daily scrum, review, retrospective",
          ],
          ["Roles", "None defined", "Product owner, scrum master, developers"],
          [
            "Iterations",
            "Short cycles encouraged, length not fixed",
            "Fixed sprints of up to one month",
          ],
          [
            "Scope",
            "Applies to any team or method",
            "One way of applying agile",
          ],
          [
            "Source",
            "Agile Manifesto, 2001",
            "The Scrum Guide, maintained by its creators",
          ],
        ],
      },
    },
    {
      heading: "What agile actually says",
      body: [
        "The Agile Manifesto values individuals and interactions over processes and tools, working software over comprehensive documentation, customer collaboration over contract negotiation, and responding to change over following a plan. It is explicit that the items on the right still have value; the left simply matters more.",
        "In practice that means delivering in small pieces, getting feedback early, keeping teams small and close to the people they build for, and treating the plan as something that will change.",
      ],
    },
    {
      heading: "What scrum adds",
      items: [
        {
          name: "Sprints",
          body: "Fixed time boxes, commonly two weeks, each ending with a usable increment. The length stays constant so the team learns its pace.",
        },
        {
          name: "Three accountabilities",
          body: "A product owner who orders the backlog, a scrum master who helps the team work well, and developers who do the work.",
        },
        {
          name: "Five events",
          body: "The sprint itself, sprint planning, a daily scrum of fifteen minutes, a sprint review with stakeholders, and a retrospective.",
        },
        {
          name: "Three artefacts",
          body: "The product backlog, the sprint backlog, and the increment, each with a commitment: the product goal, the sprint goal, and the definition of done.",
          href: "/guides/definition-of-done-checklist",
        },
      ],
    },
    {
      heading: "Other ways to be agile",
      body: [
        "Kanban manages continuous flow with a board and work-in-progress limits instead of sprints. Extreme programming (XP) focuses on engineering practices such as pair programming, test-driven development, and continuous integration. Scaled frameworks like SAFe and LeSS apply agile across many teams.",
        "Most teams end up with a mix: a kanban board, a weekly planning session, a retrospective every few weeks, and engineering practices borrowed from XP. That is still agile, as long as the team keeps delivering small, getting feedback, and adjusting.",
      ],
    },
    {
      heading: "Agile work in Kaneo",
      body: [
        "Kaneo is a kanban-style tracker: a board with columns you define, a backlog for upcoming work, and Gantt and calendar views for anything with a date. That covers kanban and most lightweight agile setups as they come.",
        "There are no built-in sprints or story points. Teams running scrum in Kaneo usually tag each sprint with a label, keep estimates in a number custom field, and filter the board by the current sprint. If burndown charts and velocity are central to how you work, a scrum-focused tool will serve you better.",
      ],
    },
  ],
  faq: [
    {
      question: "Is scrum the same as agile?",
      answer:
        "No. Scrum is one framework for practising agile. Agile is the broader set of values and principles that scrum, kanban, and others put into practice.",
    },
    {
      question: "Can you be agile without scrum?",
      answer:
        "Yes. Many agile teams use kanban, XP, or a lightweight process of their own. What makes a team agile is how it works: small increments, frequent feedback, and adapting the plan.",
    },
    {
      question: "Is kanban agile or scrum?",
      answer:
        "Kanban is an agile method, separate from scrum. It uses continuous flow and WIP limits instead of sprints and fixed roles.",
    },
    {
      question: "What is the difference between agile and waterfall?",
      answer:
        "Waterfall plans the whole project up front and moves through phases in sequence, delivering at the end. Agile delivers in small increments and re-plans as it learns.",
    },
  ],
  related: [
    { label: "Kanban vs scrum", href: "/guides/kanban-vs-scrum" },
    { label: "What is kanban?", href: "/guides/what-is-kanban" },
    { label: "Backlog grooming", href: "/guides/backlog-grooming" },
  ],
  updatedOn: "2026-10-19",
};
