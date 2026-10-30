import type { Guide } from "./types";

export const projectManagementForAgencies: Guide = {
  slug: "project-management-for-agencies",
  question: "How should an agency manage client projects?",
  title: "Project Management for Agencies: Clients and Tools",
  description:
    "How agencies can run many client projects at once: scope per client, client visibility without oversharing, capacity across projects, and choosing a tool.",
  summary:
    "Separate client work, share progress safely, and keep an eye on capacity across projects.",
  answer:
    "Agencies juggle many client projects at once, each with its own scope, deadline, and stakeholders, while sharing one team. Good agency project management keeps each client's work separate, gives clients visibility without exposing other clients or internal discussion, tracks scope changes so they get billed, and shows who is overloaded across all projects. The tool should make those four things easy without per-seat pricing that punishes inviting clients and freelancers.",
  sections: [
    {
      heading: "What makes agency work different",
      items: [
        {
          name: "Many clients, one team",
          body: "The same designer may work on five accounts in a week. Each client sees only their project; the team needs to see everything.",
        },
        {
          name: "Scope is money",
          body: "Unbilled extra work is the most common way agencies lose margin. Every change request needs to be visible and priced.",
          href: "/guides/what-is-project-scope",
        },
        {
          name: "Clients want to see progress",
          body: "Weekly status emails take hours to write. Letting clients look at the work directly saves the time, if it is done without oversharing.",
        },
        {
          name: "Freelancers come and go",
          body: "Contractors need access to one or two projects for a few weeks, and none of the rest.",
        },
      ],
    },
    {
      heading: "A structure that works",
      body: [
        "One project per client engagement, not one per client: a retainer and a website rebuild for the same client are different scopes with different end dates. Use the same columns across projects so anyone can read any board.",
        "Write the scope and the out-of-scope list in each project's description at kickoff, and send the client a link. New requests go into the backlog and get labelled as change requests until someone has priced and approved them.",
        "Use labels for the type of work (design, development, copy, review) and a weekly look across all projects, filtered by assignee, to spot overload before deadlines slip.",
      ],
    },
    {
      heading: "Giving clients visibility",
      table: {
        columns: ["Option", "Good for", "Watch out for"],
        rows: [
          [
            "Status emails",
            "Clients who will not open a tool",
            "Hours of writing; stale on arrival",
          ],
          [
            "Read-only board link",
            "Showing progress without accounts",
            "Anyone with the link can see it; keep internal notes elsewhere",
          ],
          [
            "Client accounts with view access",
            "Clients who comment and review",
            "Limit them to their own project",
          ],
          [
            "Shared full access",
            "Very close partnerships",
            "Clients see internal discussion and other work",
          ],
        ],
      },
    },
    {
      heading: "Common mistakes",
      body: [
        "Running client communication in the project tool. Tasks are for work; approvals, contracts, and feedback threads often belong in email or a dedicated portal, with a link from the task.",
        "Paying per seat for occasional users. Agencies invite many clients and freelancers who log in once a month. Per-user pricing turns each invitation into a budget decision.",
        "No cross-project view of capacity. Every project looks fine on its own while one person has three deadlines on the same Friday.",
      ],
    },
    {
      heading: "How Kaneo fits",
      body: [
        "Each client engagement becomes a Kaneo project with its own board, backlog, and Gantt view. Members can be limited to selected projects, so a client or freelancer only sees their own work, including through their API keys. The Viewer role gives read-only access, and a project can also have a public link that shows the board and its tasks to anyone with the link, read-only.",
        "Time tracking on tasks, labels, custom fields, and filters by assignee cover the day-to-day. Self-hosted Kaneo is free with no user limits, so inviting clients and contractors costs nothing; Kaneo Cloud is $5 per user a month for teams.",
        "Kaneo does not do invoicing, proposals, or resource scheduling by hours. Agencies that want those in the same tool usually pair a tracker with dedicated billing software.",
      ],
    },
  ],
  faq: [
    {
      question: "What is the best project management software for agencies?",
      answer:
        "One that separates client work cleanly, shares progress with clients safely, and does not charge per seat for the clients and freelancers you invite. Kaneo covers that and is free to self-host; all-in-one agency suites add invoicing and resourcing at a higher price.",
    },
    {
      question: "Should clients have access to our project management tool?",
      answer:
        "Read-only access to their own project usually saves more time than it costs. Keep internal discussion and pricing out of tasks the client can see, or use a public read-only link instead of accounts.",
    },
    {
      question: "How do agencies handle scope creep?",
      answer:
        "By writing the scope and exclusions down at kickoff, logging every new request, and pricing changes before doing them. A change request label in the backlog makes the extra work visible at billing time.",
    },
    {
      question: "One project per client or per engagement?",
      answer:
        "Per engagement. Separate engagements have separate scopes, budgets, and end dates, and mixing them makes all three harder to track.",
    },
  ],
  related: [
    {
      label: "Best project management tool for startups",
      href: "/guides/project-management-tool-for-startups",
    },
    { label: "Scope of work (SOW) template", href: "/guides/scope-of-work" },
    { label: "What is project scope?", href: "/guides/what-is-project-scope" },
    {
      label: "Best project management tools for small teams",
      href: "/guides/project-management-for-small-teams",
    },
    { label: "Pricing", href: "/pricing" },
  ],
  updatedOn: "2026-10-19",
};
