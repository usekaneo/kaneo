/**
 * Grouping for the "link a task" picker's cross-project search results.
 *
 * Extracted from task-relations.tsx so the grouping/exclusion rules (one
 * group per other project, current project and already-linked tasks left
 * out) can be unit tested without rendering the command palette.
 */

export type PickerTaskItem = {
  id: string;
  title: string;
  number: number | null;
  status: string;
  description?: string;
  /** Present only for a task from another project, driving the cross-project group's rendering. */
  projectId?: string;
  projectSlug?: string;
};

export type PickerTaskGroup = {
  value: string;
  label: string;
  items: PickerTaskItem[];
};

export type CrossProjectSearchResult = {
  type: string;
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  projectSlug?: string;
  taskNumber?: number;
  status?: string;
};

type BuildCrossProjectTaskGroupsParams = {
  results: CrossProjectSearchResult[];
  currentProjectId: string;
  /** Task ids to leave out: the task itself and tasks it's already related to. */
  excludedTaskIds: ReadonlySet<string>;
  labelForProject: (projectName: string) => string;
};

/**
 * Groups workspace-search results into one command-palette group per other
 * project, sorted by project name. Tasks in the current project are left
 * out — those already have their own "tasks in project" group — along with
 * non-task results and excluded task ids.
 */
export function buildCrossProjectTaskGroups({
  results,
  currentProjectId,
  excludedTaskIds,
  labelForProject,
}: BuildCrossProjectTaskGroupsParams): PickerTaskGroup[] {
  const byProject = new Map<
    string,
    { projectName: string; items: PickerTaskItem[] }
  >();

  for (const result of results) {
    if (result.type !== "task") continue;
    if (!result.projectId || result.projectId === currentProjectId) continue;
    if (excludedTaskIds.has(result.id)) continue;

    const projectName = result.projectName || result.projectSlug || "";
    const item: PickerTaskItem = {
      id: result.id,
      title: result.title,
      number: result.taskNumber ?? null,
      status: result.status ?? "",
      description: result.description,
      projectId: result.projectId,
      projectSlug: result.projectSlug,
    };

    const existing = byProject.get(result.projectId);
    if (existing) {
      existing.items.push(item);
    } else {
      byProject.set(result.projectId, { projectName, items: [item] });
    }
  }

  return Array.from(byProject.entries())
    .sort(([, a], [, b]) => a.projectName.localeCompare(b.projectName))
    .map(([projectId, group]) => ({
      value: `project-${projectId}`,
      label: labelForProject(group.projectName),
      items: group.items,
    }));
}

/**
 * Whether a picker item is a genuine other-project result, as opposed to a
 * same-project task. Same-project items (from the current project's own
 * column data) also carry a `projectId` at runtime, so it is not enough to
 * check that the field is merely present — it must differ from the task
 * being viewed's own project.
 */
export function isOtherProjectItem(
  item: Pick<PickerTaskItem, "projectId">,
  currentProjectId: string,
): boolean {
  return !!item.projectId && item.projectId !== currentProjectId;
}
