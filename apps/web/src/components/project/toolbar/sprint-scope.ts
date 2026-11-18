import { filterProjectTasks } from "@/lib/task-filters/filter-project-tasks";
import type { ProjectWithTasks } from "@/types/project";
import type Sprint from "@/types/sprint";
import type Task from "@/types/task";

// Which sprint slice the board shows: the currently active sprint, every
// sprint, the unscheduled backlog, or one concrete sprint by id.
export type SprintScope = "current" | "all" | "backlog" | (string & {});

export const DEFAULT_SPRINT_SCOPE: SprintScope = "current";

const MAX_SCOPE_LENGTH = 128;

export function normalizeSprintScope(raw: unknown): SprintScope {
  if (
    typeof raw === "string" &&
    raw.length > 0 &&
    raw.length <= MAX_SCOPE_LENGTH
  ) {
    return raw;
  }
  return DEFAULT_SPRINT_SCOPE;
}

// Returns the predicate a task must satisfy to be visible for the scope, or
// null when the scope does not restrict the board at all.
export function sprintScopeTaskMatcher(
  scope: SprintScope,
  sprints: readonly Sprint[],
): ((task: Task) => boolean) | null {
  if (scope === "all") {
    return null;
  }

  if (scope === "backlog") {
    return (task) => task.sprintId == null;
  }

  let sprintId: string | null = null;
  if (scope === "current") {
    sprintId = sprints.find((sprint) => sprint.status === "active")?.id ?? null;
  } else if (sprints.some((sprint) => sprint.id === scope)) {
    sprintId = scope;
  }

  // Without a sprint to match (no active sprint, or the selected sprint was
  // deleted) the scope cannot restrict anything, so every task stays visible.
  if (!sprintId) {
    return null;
  }

  return (task) => task.sprintId === sprintId;
}

export function filterProjectBySprintScope(
  project: ProjectWithTasks,
  scope: SprintScope,
  sprints: readonly Sprint[],
): ProjectWithTasks {
  const matcher = sprintScopeTaskMatcher(scope, sprints);
  if (!matcher) {
    return project;
  }
  return filterProjectTasks(project, matcher);
}
