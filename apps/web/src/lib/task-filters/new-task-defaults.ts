import {
  boardFiltersStorageKey,
  normalizeFilters,
} from "@/hooks/use-task-filters-with-labels-support";
import type { BoardFilters } from "@/hooks/use-task-filters";
import { customFieldSubjectId } from "./filter-subject-id";
import { type FilterLabel, labelGroupKey } from "./label-groups";

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;

export type NewTaskDefaults = {
  priority: (typeof PRIORITIES)[number] | null;
  assigneeId: string | null;
  labelIds: string[];
  /** fieldId -> the one raw value the filter allows for that field. */
  customFields: Record<string, string>;
};

export const EMPTY_NEW_TASK_DEFAULTS: NewTaskDefaults = {
  priority: null,
  assigneeId: null,
  labelIds: [],
  customFields: {},
};

/**
 * Values a new task should start with so that it matches the board filters
 * that are active when it is created (otherwise it vanishes from the view).
 *
 * Only filters that name a concrete value are used:
 * - a negated filter ("is not X") never yields a value;
 * - priority and assignee are used only when exactly one value is selected,
 *   because with several there is no way to pick the right one;
 * - labels are all used: a task can carry every selected label;
 * - custom fields are used only when exactly one value is allowed;
 * - status is left to the column / project default, and due-date filters are
 *   relative ranges ("due this week"), so neither is ever used.
 */
export function getNewTaskDefaults(filters: BoardFilters): NewTaskDefaults {
  const negated = new Set(filters.negated ?? []);

  const priority =
    !negated.has("priority") && filters.priority?.length === 1
      ? (PRIORITIES.find((value) => value === filters.priority?.[0]) ?? null)
      : null;

  const assignee =
    !negated.has("assignee") && filters.assignee?.length === 1
      ? filters.assignee[0]
      : "";

  const customFields: Record<string, string> = {};
  for (const [fieldId, allowed] of Object.entries(filters.customFields ?? {})) {
    if (negated.has(customFieldSubjectId(fieldId)) || allowed.length !== 1) {
      continue;
    }
    customFields[fieldId] = allowed[0];
  }

  return {
    priority,
    assigneeId: assignee || null,
    labelIds: negated.has("labels") ? [] : (filters.labels ?? []),
    customFields,
  };
}

/** Reads the filters the board toolbar persisted for a project, if any. */
export function readStoredNewTaskDefaults(
  projectId: string | undefined,
): NewTaskDefaults {
  if (!projectId || typeof window === "undefined") {
    return EMPTY_NEW_TASK_DEFAULTS;
  }
  try {
    const raw = window.localStorage.getItem(boardFiltersStorageKey(projectId));
    return raw === null
      ? EMPTY_NEW_TASK_DEFAULTS
      : getNewTaskDefaults(normalizeFilters(JSON.parse(raw)));
  } catch {
    return EMPTY_NEW_TASK_DEFAULTS;
  }
}

/**
 * Resolves filter label ids to the labels to attach. A filter may hold the id
 * of a workspace catalog label or of a per-task copy of it; both resolve to
 * one entry per name+color group, preferring the catalog label (taskId null),
 * which is what the modal's label picker offers. Unknown ids are dropped.
 */
export function resolveDefaultLabels<
  T extends FilterLabel & { taskId: string | null },
>(workspaceLabels: T[], labelIds: string[]): T[] {
  const selected = new Set(labelIds);
  const groups = new Map<string, T>();
  for (const label of workspaceLabels) {
    if (!selected.has(label.id)) continue;
    const key = labelGroupKey(label);
    const catalog = workspaceLabels.find(
      (candidate) =>
        candidate.taskId === null && labelGroupKey(candidate) === key,
    );
    groups.set(key, catalog ?? label);
  }
  const byName = new Map<string, T>();
  for (const label of groups.values()) {
    if (!byName.has(label.name)) byName.set(label.name, label);
  }
  return [...byName.values()];
}
