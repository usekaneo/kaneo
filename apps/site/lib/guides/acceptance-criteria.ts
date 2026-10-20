import type { Guide } from "./types";

export const acceptanceCriteria: Guide = {
  slug: "acceptance-criteria",
  question: "What are acceptance criteria?",
  title: "Acceptance Criteria: Formats, Examples, and Tips",
  description:
    "What acceptance criteria are, the checklist and Given/When/Then formats with examples, how they differ from the definition of done, and how to write good ones.",
  summary:
    "Two formats with examples, the difference from the definition of done, and how to write criteria that can be tested.",
  answer:
    "Acceptance criteria are the specific conditions a single task or user story must meet to be accepted as complete. They describe the expected behaviour from the user's or requester's point of view, are agreed before work starts, and are written so anyone can check them with a clear yes or no. They are usually a short checklist or a set of Given/When/Then scenarios.",
  sections: [
    {
      heading: "Two common formats",
      items: [
        {
          name: "Checklist (rule-oriented)",
          body: "A list of statements that must all be true. Quick to write and easy to read; suits most tasks.",
        },
        {
          name: "Given / When / Then (scenario-oriented)",
          body: "Each criterion is a scenario: given a starting situation, when the user does something, then a specific result happens. Suits behaviour with several paths, and maps directly onto automated tests.",
        },
      ],
    },
    {
      heading: "Example: password reset",
      body: [
        "User story: as a user who forgot my password, I want to reset it by email so that I can get back into my account.",
        'Checklist version: a "Forgot password" link is shown on the sign-in page; entering a registered email sends a reset link within one minute; the link expires after 30 minutes and works only once; entering an unregistered email shows the same confirmation message, so the form does not reveal which emails have accounts; after resetting, the user is signed in and other sessions are signed out.',
        "Given/When/Then version, for one scenario: given a user with a reset link older than 30 minutes, when they open the link, then they see a message that the link has expired and a button to request a new one.",
      ],
    },
    {
      heading: "Acceptance criteria vs definition of done",
      table: {
        columns: ["", "Acceptance criteria", "Definition of done"],
        rows: [
          ["Scope", "One task or story", "Every task"],
          [
            "Describes",
            "What this piece of work must do",
            "The quality bar all work must meet",
          ],
          [
            "Written by",
            "The requester or product owner, with the team",
            "The team, once",
          ],
          [
            "Example",
            "The reset link expires after 30 minutes",
            "Code reviewed and tests pass",
          ],
        ],
      },
      items: [
        {
          name: "Definition of done checklist",
          body: "A template you can copy, and examples for different teams.",
          href: "/guides/definition-of-done-checklist",
        },
      ],
    },
    {
      heading: "How to write good acceptance criteria",
      items: [
        {
          name: "Write them before work starts",
          body: "Criteria written during review describe what was built, not what was needed.",
        },
        {
          name: "Describe outcomes, not implementation",
          body: '"The page loads in under two seconds" leaves the team free to choose how. "Add a cache" does not.',
        },
        {
          name: "Make each one testable",
          body: 'Each criterion should have a clear yes or no answer. "User-friendly" and "fast" are not testable; specific numbers and behaviours are.',
        },
        {
          name: "Include the unhappy paths",
          body: "Errors, empty states, and permissions are where most bugs hide and where criteria are most often missing.",
        },
        {
          name: "Keep the list short",
          body: "Three to seven criteria is typical. More than that usually means the story should be split.",
        },
      ],
    },
    {
      heading: "Acceptance criteria in Kaneo",
      body: [
        "Write the criteria in the task description as a checkbox list, so they are the first thing the person picking up the task sees and each one can be ticked off during review. For Given/When/Then scenarios, a short list under a heading in the description works well.",
        "During backlog refinement, treat a task without criteria as not ready yet. Moving a task to a Review column before Done gives a clear point where someone other than the author checks each criterion.",
      ],
    },
  ],
  faq: [
    {
      question: "Who writes acceptance criteria?",
      answer:
        "Usually the product owner or whoever requested the work, refined together with the people doing it. The team's input catches criteria that are ambiguous or unexpectedly expensive.",
    },
    {
      question:
        "What is the difference between acceptance criteria and requirements?",
      answer:
        "Requirements describe what a system or product needs overall. Acceptance criteria are the testable conditions for one specific piece of work, often derived from those requirements.",
    },
    {
      question: "Do acceptance criteria replace test cases?",
      answer:
        "No, but they are the starting point. Each criterion usually becomes one or more test cases, and Given/When/Then criteria can often be turned into automated tests directly.",
    },
    {
      question: "How many acceptance criteria should a user story have?",
      answer:
        "Typically three to seven. If you need many more, the story is probably too large and should be split.",
    },
  ],
  related: [
    {
      label: "Definition of done checklist",
      href: "/guides/definition-of-done-checklist",
    },
    { label: "Backlog grooming", href: "/guides/backlog-grooming" },
    { label: "Scope of work", href: "/guides/scope-of-work" },
  ],
  updatedOn: "2026-10-19",
};
