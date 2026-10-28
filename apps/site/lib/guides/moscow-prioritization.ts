import type { Guide } from "./types";

export const moscowPrioritization: Guide = {
  slug: "moscow-prioritization",
  question: "What is MoSCoW prioritization?",
  title: "MoSCoW Prioritization: Method and Examples",
  description:
    "The MoSCoW method explained: Must, Should, Could, and Won't have, a worked release example, the 60% rule, and how to stop every item becoming a Must.",
  summary:
    "Must, Should, Could, Won't: a worked example and the rules that stop everything becoming a Must.",
  answer:
    "MoSCoW is a prioritization method that sorts work into four groups for a given release or deadline: Must have, Should have, Could have, and Won't have this time. Musts are non-negotiable for the release to be viable, Shoulds are important but can slip, Coulds are nice extras, and Won'ts are explicitly out. It makes the trade-off visible when time is fixed and scope has to give.",
  sections: [
    {
      heading: "The four categories",
      items: [
        {
          name: "Must have",
          body: "Without it the release fails: it is illegal, unsafe, unusable, or breaks the core promise. A good test is whether you would cancel the release if it were missing.",
        },
        {
          name: "Should have",
          body: "Important and expected, but there is a workaround or it can follow shortly after. Painful to drop, not fatal.",
        },
        {
          name: "Could have",
          body: "Valuable if there is time, small impact if there is not. These are the first to go when the schedule slips.",
        },
        {
          name: "Won't have (this time)",
          body: "Agreed to be out of this release. Writing them down stops the same requests from returning every week and records them for later.",
        },
      ],
    },
    {
      heading: "A worked example: a mobile app's first release",
      table: {
        columns: ["Item", "Category", "Why"],
        rows: [
          ["Sign in and sign out", "Must", "The app is unusable without it"],
          [
            "View and complete tasks",
            "Must",
            "The core reason anyone installs it",
          ],
          [
            "Push notifications for mentions",
            "Should",
            "Expected, but email covers it for now",
          ],
          [
            "Offline mode",
            "Should",
            "Important for some users; can ship in the next update",
          ],
          ["Dark mode", "Could", "Nice to have, no effect on the core job"],
          [
            "Home screen widgets",
            "Could",
            "Small audience, more effort than it looks",
          ],
          ["Tablet layout", "Won't", "Planned for a later release"],
        ],
      },
    },
    {
      heading: "Rules that keep MoSCoW honest",
      items: [
        {
          name: "Cap the Musts",
          body: "A common guideline is that Musts take no more than about 60% of the available effort, with Shoulds around 20% and Coulds the rest. That leaves room for estimates to be wrong without missing the date.",
        },
        {
          name: "Tie it to a date",
          body: "MoSCoW only works for a specific release or time box. Without one, everything drifts towards Must.",
        },
        {
          name: "Challenge every Must",
          body: 'Ask what would happen if it were missing on launch day. If the answer is "people would be disappointed", it is a Should.',
        },
        {
          name: "Decide who settles disputes",
          body: "Agree in advance who makes the final call when stakeholders disagree on a category, usually the product owner.",
        },
      ],
    },
    {
      heading: "MoSCoW compared with other methods",
      body: [
        "MoSCoW is coarse on purpose: it answers what is in and out, not the exact order. Within each group you still need a ranking. RICE and weighted scoring give finer numbers but are harder to explain to stakeholders, while the Eisenhower matrix suits personal work better than release scope.",
        "The method was created by Dai Clegg at Oracle in 1994 and later became part of the Dynamic Systems Development Method (DSDM). The lower-case o letters are only there to make the acronym pronounceable.",
      ],
    },
    {
      heading: "MoSCoW in Kaneo",
      body: [
        "Create four labels, Must, Should, Could, and Won't, or a dropdown custom field with those values, and tag each item in the release. Filter the backlog or board by the field to see each group, and by Must alone when checking whether the release is on track.",
        "Use Kaneo's priority field for the order within a group. Items marked Won't can stay in the backlog, so they are there for the next release without cluttering the board.",
      ],
    },
  ],
  faq: [
    {
      question: "What does MoSCoW stand for?",
      answer:
        "Must have, Should have, Could have, and Won't have (this time). The o letters are added to make it readable.",
    },
    {
      question: "What is the difference between Must and Should?",
      answer:
        "A Must is required for the release to work at all. A Should is important but has a workaround or can follow soon after without the release failing.",
    },
    {
      question: "Is MoSCoW agile?",
      answer:
        "It comes from DSDM, an agile framework, and works well in any time-boxed delivery: sprints, releases, or fixed-date projects.",
    },
    {
      question: "What are the disadvantages of MoSCoW?",
      answer:
        "It does not rank items within a category, and without discipline stakeholders push everything into Must. A cap on the Must effort and a clear decision-maker address both.",
    },
  ],
  related: [
    {
      label: "How to prioritize tasks",
      href: "/guides/how-to-prioritize-tasks",
    },
    { label: "What is project scope?", href: "/guides/what-is-project-scope" },
    { label: "Backlog grooming", href: "/guides/backlog-grooming" },
  ],
  updatedOn: "2026-10-19",
};
