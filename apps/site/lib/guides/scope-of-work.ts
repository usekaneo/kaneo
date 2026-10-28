import type { Guide } from "./types";

export const scopeOfWork: Guide = {
  slug: "scope-of-work",
  question: "What is a scope of work?",
  title: "Scope of Work (SOW): How to Write One, With Template",
  description:
    "What a scope of work (SOW) is, the sections every SOW needs, a filled-in example for a client project, and the wording mistakes that lead to disputes.",
  summary:
    "The sections every SOW needs, a client project example, and the wording that prevents disputes.",
  answer:
    "A scope of work (SOW) is a document, usually part of a contract, that describes exactly what a vendor, agency, or team will deliver: the work, the deliverables, the timeline, how the result will be accepted, and how it will be paid for. Its job is to make sure both sides picture the same finished project before any work starts. When a dispute comes up later, the SOW is what everyone goes back to.",
  sections: [
    {
      heading: "Scope of work vs scope statement vs statement of work",
      body: [
        "A scope statement is an internal project document that defines the project's boundaries. A scope of work is the client-facing or contractual version, with the commercial terms needed to hold both sides to it. A statement of work usually means the same thing as a scope of work, though some organisations use it for a broader contract document that contains the scope of work as one section.",
        "If you are running an internal project, you need a scope statement. If someone is paying someone else for the work, you need an SOW.",
      ],
      items: [
        {
          name: "Writing an internal scope statement",
          body: "Objective, deliverables, in scope, out of scope, and how to handle scope creep.",
          href: "/guides/what-is-project-scope",
        },
      ],
    },
    {
      heading: "The sections every SOW needs",
      items: [
        {
          name: "Background and objectives",
          body: "Why the project exists and what it should achieve, so both sides can judge decisions against the same goal.",
        },
        {
          name: "Scope",
          body: "The work included, described specifically enough that a third party could tell whether it was done.",
        },
        {
          name: "Exclusions",
          body: "What is not included. The list that saves the most arguments.",
        },
        {
          name: "Deliverables",
          body: 'Each thing that will be handed over, with format and quantity: "five page templates in Figma", not "designs".',
        },
        {
          name: "Timeline and milestones",
          body: "Start date, milestone dates, and what each milestone requires from both sides, including client feedback deadlines.",
          href: "/guides/project-milestones",
        },
        {
          name: "Acceptance criteria",
          body: "How each deliverable will be reviewed, by whom, within how many days, and what counts as accepted.",
          href: "/guides/acceptance-criteria",
        },
        {
          name: "Payment terms",
          body: "Fixed price, time and materials, or retainer, and which milestones trigger which invoices.",
        },
        {
          name: "Change process",
          body: "How new requests are submitted, estimated, approved, and billed.",
        },
      ],
    },
    {
      heading: "A filled-in example",
      table: {
        columns: ["Section", "Example: website redesign for a client"],
        rows: [
          [
            "Objective",
            "Increase demo requests from the website by making the product pages clearer.",
          ],
          [
            "Scope",
            "Redesign and build the home page, three product pages, and the pricing page on the client's existing CMS.",
          ],
          [
            "Exclusions",
            "Blog, documentation, copywriting beyond the five pages, hosting changes, translations.",
          ],
          [
            "Deliverables",
            "Wireframes for 5 pages; high-fidelity designs for desktop and mobile; built templates; a 1-hour handover session.",
          ],
          [
            "Timeline",
            "Wireframes week 2, designs week 5, build complete week 9, launch week 10.",
          ],
          [
            "Acceptance",
            "Client reviews each deliverable within 5 working days; two rounds of revisions included per deliverable.",
          ],
          [
            "Payment",
            "Fixed fee, 30% at signing, 40% on design approval, 30% on launch.",
          ],
          [
            "Changes",
            "Requests outside scope are quoted in writing within 3 working days and start only after approval.",
          ],
        ],
      },
    },
    {
      heading: "Wording that prevents disputes",
      body: [
        'Replace vague verbs with countable outputs. "Support the launch" can mean anything; "two hours of on-call support on launch day" cannot.',
        "Limit revisions explicitly. Unlimited revisions turn a fixed-price project into an open-ended one.",
        "Name the client's obligations too: content delivered by a date, feedback within a set number of days, access to systems. Delays on the client side are the most common reason projects slip, and without this the slip is yours.",
        'Avoid "etc." and "including but not limited to" in the scope section. Anything open-ended will be read generously by the side that benefits.',
      ],
    },
    {
      heading: "Running SOW work in Kaneo",
      body: [
        "Create one project per SOW, and paste the scope, exclusions, and acceptance criteria into the project description so the whole team works against the same document. Each deliverable becomes a task, with its own acceptance criteria as a checklist in the description.",
        "Put milestone tasks on the timeline with due dates, and route new client requests into the backlog with a change request label until they are quoted and approved. Give the client a Viewer account limited to their project, or share a read-only public link to the board, so they can see progress without status emails.",
      ],
    },
  ],
  faq: [
    {
      question: "Who writes the scope of work?",
      answer:
        "Usually the vendor or agency drafts it, because they know what the work involves, and the client reviews and negotiates it. Both sign it, often as part of or attached to the contract.",
    },
    {
      question: "How detailed should an SOW be?",
      answer:
        "Detailed enough that an outsider could judge whether each deliverable was delivered. If two reasonable people could read a line differently, rewrite it.",
    },
    {
      question: "What happens when the scope changes?",
      answer:
        "Follow the change process in the SOW: write the change down, estimate its cost and effect on the timeline, get written approval, and then do the work. Changes agreed only in conversation are the source of most disputes.",
    },
    {
      question: "Is an SOW legally binding?",
      answer:
        "When it is signed as part of a contract, it usually is. Have anything with significant money at stake reviewed by someone qualified; this guide is not legal advice.",
    },
  ],
  related: [
    { label: "What is project scope?", href: "/guides/what-is-project-scope" },
    {
      label: "Project management for agencies",
      href: "/guides/project-management-for-agencies",
    },
    { label: "Acceptance criteria", href: "/guides/acceptance-criteria" },
  ],
  updatedOn: "2026-10-19",
};
