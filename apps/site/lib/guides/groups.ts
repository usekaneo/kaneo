import { type Guide, guideList, guides } from "./index";

export type GuideGroup = {
  id: string;
  title: string;
  guides: Guide[];
};

const groups: { id: string; title: string; slugs: string[] }[] = [
  {
    id: "choosing-a-tool",
    title: "Choosing a tool",
    slugs: [
      "best-open-source-project-management-software",
      "open-source-jira-alternatives",
      "self-hosted-trello-alternatives",
      "best-free-kanban-board-software",
      "project-management-tools-with-free-sso",
      "project-management-tool-for-startups",
      "project-management-for-small-teams",
      "project-management-for-software-teams",
      "it-project-management",
      "project-management-for-agencies",
    ],
  },
  {
    id: "planning-a-project",
    title: "Planning a project",
    slugs: [
      "what-is-project-planning",
      "project-charter",
      "what-is-project-scope",
      "scope-of-work",
      "work-breakdown-structure",
      "raci-chart",
      "project-kickoff-meeting",
      "project-life-cycle",
    ],
  },
  {
    id: "scheduling",
    title: "Timelines and scheduling",
    slugs: [
      "what-is-a-project-timeline",
      "what-is-a-gantt-chart",
      "critical-path-method",
      "task-dependencies",
      "project-milestones",
    ],
  },
  {
    id: "agile-and-kanban",
    title: "Agile and kanban",
    slugs: [
      "what-is-kanban",
      "kanban-vs-scrum",
      "agile-vs-scrum",
      "backlog-grooming",
      "how-to-prioritize-tasks",
      "moscow-prioritization",
      "definition-of-done-checklist",
      "acceptance-criteria",
    ],
  },
  {
    id: "self-hosting-and-integrations",
    title: "Self-hosting and integrations",
    slugs: [
      "self-host-project-management-docker",
      "cloud-vs-on-premise-project-management",
      "eu-hosted-project-management-gdpr",
      "project-management-mcp-ai-agents",
      "github-issues-kanban-board",
      "gitea-project-management",
    ],
  },
];

const grouped = new Set(groups.flatMap((group) => group.slugs));
const ungrouped = guideList.filter((guide) => !grouped.has(guide.slug));

export const guideGroups: GuideGroup[] = [
  ...groups.map(({ id, title, slugs }) => ({
    id,
    title,
    guides: slugs.flatMap((slug) => (guides[slug] ? [guides[slug]] : [])),
  })),
  ...(ungrouped.length > 0
    ? [{ id: "more-guides", title: "More guides", guides: ungrouped }]
    : []),
];
