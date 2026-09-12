import type { Guide } from "./types";

export const bestFreeKanbanBoardSoftware: Guide = {
  slug: "best-free-kanban-board-software",
  question: "What is the best free kanban board software?",
  title: "Best free kanban board software in 2026",
  description:
    "Free kanban boards that stay free: which are open source, which cap users, and which quietly move features into a paid tier as you grow.",
  summary:
    "Which free kanban boards are genuinely free, and where the limits actually bite.",
  answer:
    "If free means self-hosted and unlimited, the answer is Kaneo, WeKan, or Kanboard, all MIT licensed with no user caps or feature gates. If free means a hosted account with no card, Trello, ClickUp, and Wrike have real free tiers, each with limits that arrive sooner than you expect. The distinction that matters is whether the tool has a paid edition at all, because that is what decides which features can move later.",
  sections: [
    {
      heading: "Free because it is open source",
      items: [
        {
          name: "Kaneo",
          meta: "MIT, no paid edition",
          href: "/trello-alternative",
          body: "Unlimited users, projects, and boards when you self-host, with backlog, workflow rules, roles, time tracking, single sign-on, and an API included. Costs you a small server. There is a managed cloud if you would rather not run it, but the self-hosted build is not a trial.",
        },
        {
          name: "WeKan",
          meta: "MIT",
          href: "/wekan-alternative",
          body: "A mature, board-focused option with swimlanes and many install methods, on Meteor and MongoDB.",
        },
        {
          name: "Kanboard",
          meta: "MIT",
          href: "/kanboard-alternative",
          body: "The lightest install here. PHP with SQLite is enough, and it will sit on a $4 VPS indefinitely.",
        },
        {
          name: "PLANKA",
          meta: "Source-available, Pro tier",
          href: "/planka-alternative",
          body: "Free to self-host and close to Trello in feel, but single sign-on moved to the paid Pro tier in 2.2, and there is no export feature.",
        },
      ],
    },
    {
      heading: "Free because the vendor has a free tier",
      body: [
        "Trello's free plan allows unlimited cards with limits on boards per workspace and automation runs, and it remains the easiest board to start on. ClickUp's Free Forever plan has unlimited tasks and members but caps storage at 60MB. Wrike has a free plan for unlimited users with a basic feature set. Asana's free Personal plan stops at 2 users, and monday.com's free plan stops at 2 seats and 3 boards.",
        "These are genuinely usable, and none of them let you keep the data on your own infrastructure. Treat a hosted free tier as a trial with an indefinite deadline: fine for a side project, riskier as the place your company's work lives.",
      ],
    },
    {
      heading: "The questions that decide it",
      body: [
        "Does the tool have a paid edition? If yes, assume any feature can eventually sit behind it. PLANKA moved single sign-on into Pro. Vikunja put time tracking into Pro. Both are legitimate business decisions, and both changed what free meant.",
        "What happens at your tenth user? Hosted free tiers usually break here. Self-hosted open-source tools do not care.",
        "Can you export? Check before you have 800 cards, not after.",
        "Who will run it? A self-hosted board needs backups and updates. If nobody will own that, a $4 to $5 per user cloud plan is the cheaper answer once you count the hours.",
      ],
    },
  ],
  faq: [
    {
      question: "What is the best free kanban board for a small team?",
      answer:
        "Kaneo if you can self-host, because it is MIT licensed with unlimited users and includes single sign-on and time tracking. Trello if you want a hosted account with nothing to run, accepting its per-workspace board limits.",
    },
    {
      question: "Is there a free kanban board with no user limit?",
      answer:
        "Yes. Self-hosted Kaneo, WeKan, and Kanboard have no user limits at all, because there is no per-seat billing to enforce. Wrike's hosted free plan also allows unlimited users with a reduced feature set.",
    },
    {
      question: "Is Trello still free?",
      answer:
        "Trello keeps a free plan with unlimited cards, limits on boards per workspace, and limited automation. It cannot be self-hosted, so your data stays with Atlassian.",
    },
    {
      question: "What does Kaneo cost if I do not want to self-host?",
      answer:
        "Kaneo Cloud is $4 a month for a single user and $5 per user a month for teams, with a 14-day trial and no credit card required. It runs the same MIT-licensed software as the free self-hosted build.",
    },
  ],
  related: [
    {
      label: "Self-hosted Trello alternatives",
      href: "/guides/self-hosted-trello-alternatives",
    },
    { label: "Kaneo vs Kanboard", href: "/kanboard-alternative" },
    { label: "Pricing", href: "/pricing" },
  ],
  updatedOn: "2026-08-19",
};
