import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable, projectTable } from "../database/schema";
import {
  ALL_TASK_TYPES,
  getDefaultTaskType,
  getTaskTypesForProjectType,
  isKnownTaskType,
  isValidTaskTypeForProject,
} from "../project/task-types";

export const VALID_PRIORITIES = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

/** Union of every project-type task slug (OpenAPI / route picklists). */
export const VALID_TASK_TYPES = ALL_TASK_TYPES;

export type TaskType = (typeof VALID_TASK_TYPES)[number];

export const VIRTUAL_STATUSES = ["planned", "archived"] as const;

export function assertValidPriority(priority: string): void {
  if (!(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    throw new HTTPException(400, {
      message: `Invalid priority "${priority}". Valid values: ${VALID_PRIORITIES.join(", ")}`,
    });
  }
}

export function assertValidTaskType(
  taskType: string,
  projectType?: string | null,
): void {
  if (projectType !== undefined) {
    if (!isValidTaskTypeForProject(taskType, projectType)) {
      const allowed = getTaskTypesForProjectType(projectType);
      throw new HTTPException(400, {
        message: `Invalid task type "${taskType}" for project type "${projectType ?? "development"}". Valid values: ${allowed.join(", ")}`,
      });
    }
    return;
  }

  if (!isKnownTaskType(taskType)) {
    throw new HTTPException(400, {
      message: `Invalid task type "${taskType}". Valid values: ${VALID_TASK_TYPES.join(", ")}`,
    });
  }
}

export async function assertValidTaskTypeForProject(
  taskType: string,
  projectId: string,
): Promise<void> {
  const [project] = await db
    .select({ projectType: projectTable.projectType })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  assertValidTaskType(taskType, project?.projectType ?? null);
}

export function coerceTaskType(
  taskType: string,
  projectType?: string | null,
): {
  taskType: string;
  warning?: string;
} {
  if (isValidTaskTypeForProject(taskType, projectType)) {
    return { taskType };
  }
  const fallback = getDefaultTaskType(projectType);
  return {
    taskType: fallback,
    warning: `Unknown task type "${taskType}" mapped to "${fallback}"`,
  };
}

export async function getValidTaskStatuses(
  projectId: string,
): Promise<string[]> {
  const columns = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));

  return [...columns.map((c) => c.slug), ...VIRTUAL_STATUSES];
}

export async function assertValidTaskStatus(
  status: string,
  projectId: string,
): Promise<void> {
  const validStatuses = await getValidTaskStatuses(projectId);

  if (!validStatuses.includes(status)) {
    throw new HTTPException(400, {
      message: `Invalid status "${status}". Valid statuses for this project: ${validStatuses.join(", ")}`,
    });
  }
}

export function coerceStatus(
  status: string,
  validStatuses: string[],
): { status: string; warning?: string } {
  if (validStatuses.includes(status)) {
    return { status };
  }
  return {
    status: "planned",
    warning: `Unknown status "${status}" mapped to "planned"`,
  };
}

export function coercePriority(priority: string): {
  priority: string;
  warning?: string;
} {
  if ((VALID_PRIORITIES as readonly string[]).includes(priority)) {
    return { priority };
  }
  return {
    priority: "no-priority",
    warning: `Unknown priority "${priority}" mapped to "no-priority"`,
  };
}
