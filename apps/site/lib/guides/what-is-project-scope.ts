import type { Guide } from "./types";

export const whatIsProjectScope: Guide = {
  slug: "what-is-project-scope",
  question: "What is project scope?",
  title: "What Is Project Scope? Examples and Scope Creep",
  description:
    "Project scope explained with a worked example: what a scope statement includes, why scope creep happens, and how to handle new requests without derailing.",
  summary:
    "What belongs in a scope statement, a worked example, and a simple way to stop scope creep.",
  answer:
    "Project scope is the agreed boundary of a project: the deliverables it will produce, the work needed to produce them, and what it will not include. Writing it down gives everyone something concrete to check new requests against. Scope creep is what happens when work is added to a project without a matching change in time, budget, or people.",
  sections: [
    {
      heading: "What a scope statement includes",
      items: [
        {
          name: "Objective",
          body: "Why the project exists, in a sentence. Every item below should serve it.",
        },
        {
          name: "Deliverables",
          body: "The concrete things the project hands over: a feature, a page, a report, a migrated system. If you cannot point at it when it is done, it is not a deliverable.",
        },
        {
          name: "In scope",
          body: "The work needed to produce the deliverables, at the level of detail a newcomer would need to understand the size of the project.",
        },
        {
          name: "Out of scope",
          body: "The things people will reasonably assume are included but are not. This is the most useful part of the statement and the one most often skipped.",
        },
        {
          name: "Acceptance criteria",
          body: "How the person who asked for the project will judge it finished. Agree them before work starts, not during the review.",
        },
        {
          name: "Constraints and assumptions",
          body: "Fixed dates, budgets, and technical limits, plus the things you are taking for granted, such as a vendor delivering on time or a team being available.",
        },
      ],
    },
    {
      heading: "An example scope statement",
      table: {
        columns: ["Part", "Example: annual billing for a SaaS product"],
        rows: [
          [
            "Objective",
            "Let customers pay yearly at a discount to reduce monthly churn.",
          ],
          [
            "Deliverables",
            "Annual plan option at checkout, updated pricing page, plan switch in account settings.",
          ],
          [
            "In scope",
            "Payment provider configuration, checkout changes, pricing page copy, proration when switching from monthly.",
          ],
          [
            "Out of scope",
            "Invoicing by bank transfer, new currencies, changes to the free plan, sales-led enterprise contracts.",
          ],
          [
            "Acceptance criteria",
            "A new customer can buy an annual plan, a monthly customer can switch and is charged the prorated amount, and the pricing page shows both prices.",
          ],
          [
            "Constraints",
            "Live before the start of the next quarter. No change to the existing monthly prices.",
          ],
        ],
      },
    },
    {
      heading: "Scope, time, and resources",
      body: [
        "Scope, time, and resources are linked: change one and at least one of the others has to move. Adding a deliverable without adding time or people means something else gets done worse or later. This is often called the triple constraint, with quality sitting in the middle as the thing that suffers when the other three are squeezed.",
        'The point of naming the constraint is to make the trade-off explicit. When someone asks for more, the honest answer is not yes or no, it is "yes, and here is what moves".',
      ],
    },
    {
      heading: "What scope creep is and why it happens",
      body: [
        "Scope creep is the gradual growth of a project through small additions that each seem reasonable: one more report, a second login method, support for an extra browser. None of them is large enough to trigger a conversation, so none of them gets one.",
        'It happens most when the out-of-scope list was never written, when requests arrive directly to the people doing the work instead of through whoever owns the scope, and when acceptance criteria are vague enough that "done" keeps moving.',
        "Not all growth is bad. Learning something mid-project that changes what you should build is normal. The problem is growth nobody decided on.",
      ],
    },
    {
      heading: "How to handle new requests",
      items: [
        {
          name: "Capture every request in one place",
          body: "Requests in chat threads and hallway conversations are how creep starts. Put each one in the backlog so it is visible and nothing is lost.",
        },
        {
          name: "Compare it with the scope statement",
          body: "If it is already covered, it is a clarification. If it is listed as out of scope, the answer is already written down. If it is new, it is a change.",
        },
        {
          name: "Price the change",
          body: "Say what it costs in time and what else would move. Let the person who owns the scope decide, not the person who happens to be asked.",
        },
        {
          name: "Defer by default",
          body: "Most good ideas fit better in the next project than in this one. A backlog item with a note is a perfectly good answer.",
        },
      ],
    },
    {
      heading: "Keeping scope visible in Kaneo",
      body: [
        "Write the objective, deliverables, and out-of-scope list in the project description under project settings. It is the first thing a new teammate reads, and the place to point at when a request comes in.",
        "Route new requests into the Backlog with Plan rather than straight onto the board. Planned work stays out of the active view until someone decides to take it on, which is exactly the decision scope creep skips.",
        "Use a label such as scope change on requests that alter the agreed scope, and filter by it when you review the project. Put acceptance criteria in each deliverable's description as a checkbox list, so done means the same thing to everyone.",
      ],
    },
  ],
  faq: [
    {
      question:
        "What is the difference between project scope and product scope?",
      answer:
        "Product scope describes the features and functions of what you deliver. Project scope describes the work needed to deliver it, including things like testing, training, and migration that are not part of the product itself.",
    },
    {
      question: "Who defines project scope?",
      answer:
        "The project sponsor or whoever asked for the project agrees it, and the project lead writes it down with the team. The team's input matters most on the in-scope work, because they know what the deliverables really involve.",
    },
    {
      question: "Is scope creep always bad?",
      answer:
        "No. Changing course because you learned something is good project management. Scope creep is the unmanaged version: additions that nobody priced or decided on, which quietly push dates and quality.",
    },
    {
      question: "What is a work breakdown structure?",
      answer:
        "A work breakdown structure splits the scope into deliverables and then into smaller pieces of work, level by level, until each piece can be estimated and assigned. In a tracker, that usually maps to tasks and subtasks.",
    },
  ],
  related: [
    { label: "Scope of work (SOW) template", href: "/guides/scope-of-work" },
    {
      label: "What is project planning?",
      href: "/guides/what-is-project-planning",
    },
    {
      label: "Definition of done checklist",
      href: "/guides/definition-of-done-checklist",
    },
    {
      label: "What is a project timeline?",
      href: "/guides/what-is-a-project-timeline",
    },
  ],
  updatedOn: "2026-10-19",
};
