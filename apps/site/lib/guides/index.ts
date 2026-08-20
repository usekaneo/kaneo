import { bestFreeKanbanBoardSoftware } from "./best-free-kanban-board-software";
import { bestOpenSourceProjectManagement } from "./best-open-source-project-management-software";
import { euHostedProjectManagementGdpr } from "./eu-hosted-project-management-gdpr";
import { openSourceJiraAlternatives } from "./open-source-jira-alternatives";
import { projectManagementForSmallTeams } from "./project-management-for-small-teams";
import { projectManagementMcpAiAgents } from "./project-management-mcp-ai-agents";
import { projectManagementToolsWithFreeSso } from "./project-management-tools-with-free-sso";
import { selfHostProjectManagementDocker } from "./self-host-project-management-docker";
import { selfHostedTrelloAlternatives } from "./self-hosted-trello-alternatives";
import type { Guide } from "./types";

export type { Guide, GuideItem, GuideSection } from "./types";
export { guidePath } from "./types";

const all: Guide[] = [
  bestOpenSourceProjectManagement,
  openSourceJiraAlternatives,
  selfHostedTrelloAlternatives,
  bestFreeKanbanBoardSoftware,
  projectManagementToolsWithFreeSso,
  selfHostProjectManagementDocker,
  projectManagementForSmallTeams,
  euHostedProjectManagementGdpr,
  projectManagementMcpAiAgents,
];

export const guideList = all;

export const guides: Record<string, Guide> = Object.fromEntries(
  all.map((guide) => [guide.slug, guide]),
);

export function getGuide(slug: string) {
  return guides[slug];
}
