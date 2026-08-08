import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable, customFieldDefinitionTable } from "../database/schema";

export async function assertRequiredCustomFields(
  projectId: string,
  customFields: { fieldId: string; value: string }[] = [],
): Promise<void> {
  const allFields = await db
    .select({
      id: customFieldDefinitionTable.id,
      name: customFieldDefinitionTable.name,
      type: customFieldDefinitionTable.type,
      required: customFieldDefinitionTable.required,
      defaultValue: customFieldDefinitionTable.defaultValue,
    })
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));

  const validFieldIds = new Set(allFields.map((f) => f.id));

  for (const cf of customFields) {
    if (!validFieldIds.has(cf.fieldId)) {
      throw new HTTPException(400, {
        message: `Field "${cf.fieldId}" does not belong to this project.`,
      });
    }
  }

  for (const cf of customFields) {
    if (cf.value.trim() === "") continue;
    const def = allFields.find((f) => f.id === cf.fieldId);
    if (!def) continue;

    if (def.type === "number" && Number.isNaN(Number(cf.value))) {
      throw new HTTPException(400, {
        message: `Custom field "${def.name}" expects a number, got "${cf.value}".`,
      });
    }
    if (def.type === "boolean" && !["true", "false"].includes(cf.value)) {
      throw new HTTPException(400, {
        message: `Custom field "${def.name}" expects "true" or "false", got "${cf.value}".`,
      });
    }
    if (def.type === "date" && Number.isNaN(Date.parse(cf.value))) {
      throw new HTTPException(400, {
        message: `Custom field "${def.name}" expects a valid ISO 8601 date, got "${cf.value}".`,
      });
    }
  }

  const providedIds = new Set(
    customFields.filter((f) => f.value.trim() !== "").map((f) => f.fieldId),
  );

  for (const field of allFields.filter((f) => f.required)) {
    const isSatisfied =
      providedIds.has(field.id) ||
      (field.defaultValue != null && field.defaultValue.trim() !== "");

    if (!isSatisfied) {
      throw new HTTPException(400, {
        message: `Custom field "${field.name}" is required to create a task.`,
      });
    }
  }
}

export const VALID_PRIORITIES = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const VIRTUAL_STATUSES = ["planned", "archived"] as const;

export function assertValidPriority(priority: string): void {
  if (!(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    throw new HTTPException(400, {
      message: `Invalid priority "${priority}". Valid values: ${VALID_PRIORITIES.join(", ")}`,
    });
  }
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