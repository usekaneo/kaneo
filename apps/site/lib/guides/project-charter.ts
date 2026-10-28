import type { Guide } from "./types";

export const projectCharter: Guide = {
  slug: "project-charter",
  question: "What is a project charter?",
  title: "Project Charter: What It Is, Template, and Example",
  description:
    "What a project charter is, what to put in one, a filled-in one-page example, how it differs from a project plan and a scope statement, and who signs it.",
  summary:
    "A one-page document that authorises a project, with a template and a filled-in example.",
  answer:
    "A project charter is a short document that formally starts a project. It states why the project exists, what it is expected to achieve, its rough scope, budget, and timeline, who sponsors it, and who leads it, and it gives the project manager authority to use people and money. It is written before detailed planning and is usually one or two pages long.",
  sections: [
    {
      heading: "What a project charter includes",
      items: [
        {
          name: "Purpose",
          body: "The problem or opportunity, in two or three sentences. Why now, and why this is worth the effort.",
        },
        {
          name: "Objectives and success measures",
          body: "What will be true when the project succeeds, with numbers where possible.",
        },
        {
          name: "High-level scope",
          body: "The main deliverables and the most important exclusions. Detail comes later in the scope statement.",
          href: "/guides/what-is-project-scope",
        },
        {
          name: "Milestones",
          body: "The handful of dates that matter: start, key checkpoints, and the target finish.",
          href: "/guides/project-milestones",
        },
        {
          name: "Budget and resources",
          body: "A rough budget and the teams or people expected to contribute.",
        },
        {
          name: "Stakeholders and roles",
          body: "The sponsor, the project lead, and who else is involved or affected.",
          href: "/guides/raci-chart",
        },
        {
          name: "Risks, assumptions, and constraints",
          body: "The biggest known risks, what you are taking for granted, and the limits you cannot change.",
        },
        {
          name: "Approval",
          body: "The sponsor's sign-off. This is what turns a proposal into a project.",
        },
      ],
    },
    {
      heading: "A one-page example",
      table: {
        columns: ["Section", "Example: customer self-service portal"],
        rows: [
          [
            "Purpose",
            "Support handles 1,200 tickets a month asking for invoices and plan changes. Customers want to do this themselves.",
          ],
          [
            "Objectives",
            "Cut billing-related tickets by 50% within three months of launch.",
          ],
          [
            "Scope",
            "Invoice downloads, plan upgrades and downgrades, payment method changes. Not included: refunds, account deletion.",
          ],
          [
            "Milestones",
            "Kickoff 3 Nov. Design approved 21 Nov. Beta 12 Jan. Launch 2 Feb.",
          ],
          [
            "Budget",
            "Two engineers and one designer for 12 weeks; no new tools.",
          ],
          ["Sponsor", "Head of Customer Success"],
          ["Project lead", "Senior product manager"],
          [
            "Key risks",
            "Billing provider API limits; finance approval for self-serve downgrades.",
          ],
          ["Approval", "Signed by the sponsor on 28 Oct."],
        ],
      },
    },
    {
      heading: "Charter, scope statement, and project plan",
      body: [
        "The charter answers whether to do the project and who leads it. The scope statement answers exactly what is in and out. The project plan answers how, when, and by whom. They come in that order, and each gets more detailed than the last.",
        "On small teams the three often collapse into one document. That is fine, as long as the parts that need agreement, the objective, scope, and sponsor, are agreed before work starts.",
      ],
    },
    {
      heading: "Writing a charter that gets used",
      body: [
        "Keep it to a page or two. A charter is read by sponsors and newcomers; anything longer will not be.",
        'Write measurable objectives. "Improve onboarding" cannot be checked at the end; "half of new users complete setup in their first session" can.',
        "Get it signed, or at least explicitly approved in writing. The value of a charter is that the sponsor has committed to it, which you will need the first time priorities collide.",
      ],
    },
    {
      heading: "Keeping the charter with the work in Kaneo",
      body: [
        "Put the charter in the project description under project settings, so it sits next to the tasks it authorises and every new member sees it first. Link to the signed version if your organisation keeps one elsewhere.",
        "Turn the milestones into tasks with due dates and a milestone label, and they appear on the project's Gantt and Calendar views. The deliverables in the scope section become the first tasks in the backlog.",
      ],
    },
  ],
  faq: [
    {
      question: "Who writes the project charter?",
      answer:
        "Usually the project manager or lead drafts it with the sponsor, and the sponsor approves it. On small teams the person proposing the project often writes it.",
    },
    {
      question: "How long should a project charter be?",
      answer:
        "One to two pages for most projects. Large or regulated projects can be longer, but the summary should still fit on one page.",
    },
    {
      question: "Is a project charter the same as a business case?",
      answer:
        "No. A business case argues whether a project is worth doing, usually with costs and benefits. The charter comes after that decision and authorises the project to start.",
    },
    {
      question: "Do agile teams need a project charter?",
      answer:
        "A lightweight one helps: a page with the goal, the success measures, and who decides. Many agile teams call it a team charter or a product brief.",
    },
  ],
  related: [
    { label: "Scope of work", href: "/guides/scope-of-work" },
    { label: "RACI chart", href: "/guides/raci-chart" },
    {
      label: "Project kickoff meeting",
      href: "/guides/project-kickoff-meeting",
    },
  ],
  updatedOn: "2026-10-19",
};
