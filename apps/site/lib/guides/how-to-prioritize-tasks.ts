import type { Guide } from "./types";

export const howToPrioritizeTasks: Guide = {
  slug: "how-to-prioritize-tasks",
  question: "How do you prioritize tasks?",
  title: "How to Prioritize Tasks: 6 Methods That Work",
  description:
    "Six task prioritization methods compared, from the Eisenhower matrix and MoSCoW to RICE and value vs effort, plus a simple weekly routine for a team.",
  summary:
    "Six methods side by side, which one fits which situation, and a weekly routine that keeps priorities current.",
  answer:
    "To prioritize tasks, list everything in one place, score each task on how much it matters and how soon it matters, compare that against the effort, and work from the top. Methods like the Eisenhower matrix, MoSCoW, and RICE are structured ways of doing that scoring. The method matters less than doing it regularly and in the open, so the whole team works from the same order.",
  sections: [
    {
      heading: "Six methods compared",
      table: {
        columns: ["Method", "How it works", "Best for"],
        rows: [
          [
            "Eisenhower matrix",
            "Sort by urgent and important into four boxes: do, schedule, delegate, drop",
            "Personal task lists and a busy week",
          ],
          [
            "MoSCoW",
            "Label each item Must, Should, Could, or Won't have",
            "Agreeing the scope of a release with stakeholders",
          ],
          [
            "RICE",
            "Score Reach x Impact x Confidence, divided by Effort",
            "Comparing product features with numbers",
          ],
          [
            "Value vs effort",
            "Plot on a 2x2: quick wins first, big bets planned, time sinks dropped",
            "Fast team workshops",
          ],
          [
            "Weighted scoring",
            "Score each item against a few weighted criteria",
            "Portfolio and roadmap decisions",
          ],
          [
            "Stack ranking",
            "Put every item in a single ordered list, no ties",
            "A team backlog",
          ],
        ],
      },
    },
    {
      heading: "The Eisenhower matrix",
      body: [
        "Draw two axes, urgent and important. Important and urgent: do it now. Important but not urgent: schedule it, because this box holds the work that actually moves things forward and gets crowded out. Urgent but not important: delegate it or batch it. Neither: drop it.",
        "Its weakness is that almost everything feels important. Be strict: important means it serves this quarter's goals, not that someone asked loudly.",
      ],
    },
    {
      heading: "MoSCoW and RICE",
      body: [
        "MoSCoW is useful when the question is what makes the cut for a fixed date. A common rule is that Musts should be no more than about 60% of the effort, so there is room for the plan to be wrong.",
        "RICE adds numbers. Reach is how many people a task affects in a period, Impact is how much it affects each one on a small scale, Confidence is how sure you are as a percentage, and Effort is person-weeks. The score is useful for comparing features of the same kind; it is less useful across very different work, such as a bug fix and a new product line.",
      ],
      items: [
        {
          name: "MoSCoW in detail",
          body: "Definitions, a worked example, and how to stop everything becoming a Must.",
          href: "/guides/moscow-prioritization",
        },
      ],
    },
    {
      heading: "A weekly routine for a team",
      items: [
        {
          name: "1. One list",
          body: "Everything the team might do goes into one backlog. Priorities set in separate inboxes and chat threads cannot be compared.",
          href: "/guides/backlog-grooming",
        },
        {
          name: "2. One owner of the order",
          body: "A lead or product owner decides the final order after hearing the team. Shared ownership of priorities means none.",
        },
        {
          name: "3. Rank the top, not everything",
          body: "Order the next ten to fifteen items carefully. Further down, rough buckets are enough.",
        },
        {
          name: "4. Limit work in progress",
          body: "Starting everything that is high priority means finishing nothing. Pull the next item only when one is done.",
          href: "/guides/what-is-kanban",
        },
        {
          name: "5. Revisit weekly",
          body: "Priorities change. A short weekly review keeps the order honest and lets people raise new urgent items without interrupting everyone.",
        },
      ],
    },
    {
      heading: "Prioritizing in Kaneo",
      body: [
        "Every Kaneo task has a priority: urgent, high, medium, low, or none. Cards on the board show it, and Filter narrows any view by priority, so the weekly review can start from urgent and high.",
        "Keep candidates in the Backlog and move only the top of the list onto the board. For MoSCoW, use labels or a dropdown custom field with Must, Should, Could, and Won't; for RICE or weighted scoring, number custom fields hold the inputs, and you can filter by them.",
      ],
    },
  ],
  faq: [
    {
      question: "What is the best way to prioritize tasks?",
      answer:
        "For personal work, the Eisenhower matrix is quick and effective. For a team, a single ranked backlog reviewed weekly beats any scoring formula, with MoSCoW or RICE to settle the harder calls.",
    },
    {
      question: "How do you prioritize when everything is urgent?",
      answer:
        "Ask what happens if each item waits a week. Usually only one or two have a real consequence. Do those, and for the rest, tell the requesters when they will be done instead of starting them all at once.",
    },
    {
      question: "What is the difference between urgent and important?",
      answer:
        "Urgent means it needs attention soon. Important means it contributes to your goals. Urgent but unimportant work feels productive and is the easiest to delegate or drop.",
    },
    {
      question: "How many priority levels should a team use?",
      answer:
        "Three or four is plenty. With more, the levels blur and everything drifts to the top two.",
    },
  ],
  related: [
    {
      label: "MoSCoW prioritization",
      href: "/guides/moscow-prioritization",
    },
    { label: "Backlog grooming", href: "/guides/backlog-grooming" },
    { label: "What is kanban?", href: "/guides/what-is-kanban" },
  ],
  updatedOn: "2026-10-19",
};
