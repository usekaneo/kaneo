import type { MentionedItem } from "./mention-context";

type ProjectId = string | null | undefined;

// Which projects' data a tool result or prompt context gives the model. Shared
// viewers must be able to read every one of them to see the run.
export function uniqueProjectIds(ids: Iterable<ProjectId>) {
  return [...new Set([...ids].filter((id): id is string => !!id))].sort();
}

export function projectsInTaskPage(
  projectId: ProjectId,
  page: { tasks: Array<{ projectId: string }> },
) {
  return uniqueProjectIds([
    projectId,
    ...page.tasks.map((task) => task.projectId),
  ]);
}

// Workload rows carry the projects they counted; the model gets the counts only.
export function splitWorkload<Row extends { projectIds: string[] }>(
  projectId: ProjectId,
  rows: Row[],
) {
  return {
    result: rows.map(({ projectIds: _projectIds, ...row }) => row),
    projectIds: uniqueProjectIds([
      projectId,
      ...rows.flatMap((row) => row.projectIds),
    ]),
  };
}

export function projectsInMentions(items: MentionedItem[]) {
  return uniqueProjectIds(
    items.map((item) => (item.type === "task" ? item.projectId : item.id)),
  );
}
