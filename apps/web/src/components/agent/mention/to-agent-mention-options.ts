import type { AgentMention } from "./agent-mention-token";

type SearchResult = {
  id: string;
  type: string;
  title: string;
  projectName?: string;
  projectSlug?: string;
  taskNumber?: number;
};

export type AgentMentionOption = AgentMention & {
  // Ticket id like WEB-135 for tasks, project key for projects.
  key?: string;
  context?: string;
};

export const AGENT_MENTION_OPTION_LIMIT = 8;

// Tasks first (an exact ticket id match ranks first there), then projects.
export function toAgentMentionOptions(
  tasks: SearchResult[] = [],
  projects: SearchResult[] = [],
): AgentMentionOption[] {
  const options: AgentMentionOption[] = [
    ...tasks
      .filter((item) => item.type === "task")
      .map((task) => ({
        type: "task" as const,
        id: task.id,
        label: task.title,
        key:
          task.projectSlug && task.taskNumber
            ? `${task.projectSlug}-${task.taskNumber}`
            : undefined,
        context: task.projectName,
      })),
    ...projects
      .filter((item) => item.type === "project")
      .map((project) => ({
        type: "project" as const,
        id: project.id,
        label: project.title,
        key: project.projectSlug,
      })),
  ];
  return options.slice(0, AGENT_MENTION_OPTION_LIMIT);
}
