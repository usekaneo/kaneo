import { acceptanceCriteria } from "./acceptance-criteria";
import { agileVsScrum } from "./agile-vs-scrum";
import { backlogGrooming } from "./backlog-grooming";
import { bestFreeKanbanBoardSoftware } from "./best-free-kanban-board-software";
import { bestOpenSourceProjectManagement } from "./best-open-source-project-management-software";
import { cloudVsOnPremiseProjectManagement } from "./cloud-vs-on-premise-project-management";
import { criticalPathMethod } from "./critical-path-method";
import { definitionOfDoneChecklist } from "./definition-of-done-checklist";
import { euHostedProjectManagementGdpr } from "./eu-hosted-project-management-gdpr";
import { giteaProjectManagement } from "./gitea-project-management";
import { githubIssuesKanbanBoard } from "./github-issues-kanban-board";
import { howToPrioritizeTasks } from "./how-to-prioritize-tasks";
import { itProjectManagement } from "./it-project-management";
import { kanbanVsScrum } from "./kanban-vs-scrum";
import { moscowPrioritization } from "./moscow-prioritization";
import { openSourceJiraAlternatives } from "./open-source-jira-alternatives";
import { projectCharter } from "./project-charter";
import { projectKickoffMeeting } from "./project-kickoff-meeting";
import { projectLifeCycle } from "./project-life-cycle";
import { projectManagementForAgencies } from "./project-management-for-agencies";
import { projectManagementForSmallTeams } from "./project-management-for-small-teams";
import { projectManagementForSoftwareTeams } from "./project-management-for-software-teams";
import { projectManagementMcpAiAgents } from "./project-management-mcp-ai-agents";
import { projectManagementToolForStartups } from "./project-management-tool-for-startups";
import { projectManagementToolsWithFreeSso } from "./project-management-tools-with-free-sso";
import { projectMilestones } from "./project-milestones";
import { raciChart } from "./raci-chart";
import { scopeOfWork } from "./scope-of-work";
import { selfHostProjectManagementDocker } from "./self-host-project-management-docker";
import { selfHostedTrelloAlternatives } from "./self-hosted-trello-alternatives";
import { taskDependencies } from "./task-dependencies";
import { whatIsAGanttChart } from "./what-is-a-gantt-chart";
import { whatIsAProjectTimeline } from "./what-is-a-project-timeline";
import { whatIsKanban } from "./what-is-kanban";
import { whatIsProjectPlanning } from "./what-is-project-planning";
import { whatIsProjectScope } from "./what-is-project-scope";
import { workBreakdownStructure } from "./work-breakdown-structure";
import type { Guide } from "./types";

export type { Guide, GuideItem, GuideSection, GuideTable } from "./types";
export { guidePath } from "./types";

const all: Guide[] = [
  bestOpenSourceProjectManagement,
  openSourceJiraAlternatives,
  selfHostedTrelloAlternatives,
  bestFreeKanbanBoardSoftware,
  projectManagementToolsWithFreeSso,
  selfHostProjectManagementDocker,
  projectManagementToolForStartups,
  projectManagementForSmallTeams,
  euHostedProjectManagementGdpr,
  projectManagementMcpAiAgents,
  githubIssuesKanbanBoard,
  giteaProjectManagement,
  whatIsProjectPlanning,
  whatIsProjectScope,
  whatIsAProjectTimeline,
  whatIsAGanttChart,
  definitionOfDoneChecklist,
  workBreakdownStructure,
  whatIsKanban,
  backlogGrooming,
  taskDependencies,
  kanbanVsScrum,
  agileVsScrum,
  cloudVsOnPremiseProjectManagement,
  projectManagementForSoftwareTeams,
  itProjectManagement,
  projectManagementForAgencies,
  raciChart,
  howToPrioritizeTasks,
  moscowPrioritization,
  projectCharter,
  scopeOfWork,
  projectLifeCycle,
  criticalPathMethod,
  acceptanceCriteria,
  projectMilestones,
  projectKickoffMeeting,
];

export const guideList = all;

export const guides: Record<string, Guide> = Object.fromEntries(
  all.map((guide) => [guide.slug, guide]),
);

export function getGuide(slug: string) {
  return guides[slug];
}
