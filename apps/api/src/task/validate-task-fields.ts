import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable, customFieldDefinitionTable } from "../database/schema";

export function validateCustomFieldValue(
  value: string,
  type: "number" | "boolean" | "date" | "dropdown",
  fieldName: string,
  options?: unknown,
): string | null {
  if (type === "number") {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return `Custom field "${fieldName}" expects a finite number, got "${value}".`;
    }
  }

  if (type === "boolean") {
    if (!["true", "false"].includes(value)) {
      return `Custom field "${fieldName}" expects "true" or "false", got "${value}".`;
    }
  }

  if (type === "date") {
    const isoMatch =
      /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/.exec(
        value,
      );

    if (!isoMatch) {
      return `Custom field "${fieldName}" expects a date in YYYY-MM-DD or ISO 8601 format, got "${value}".`;
    }

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      return `Custom field "${fieldName}" expects a valid ISO 8601 date, got "${value}".`;
    }

    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    const calendarDate = new Date(0);
    calendarDate.setUTCFullYear(year, month - 1, day);
    calendarDate.setUTCHours(0, 0, 0, 0);

    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day
    ) {
      return `Custom field "${fieldName}" expects a valid ISO 8601 date, got "${value}".`;
    }
  }

  if (type === "dropdown") {
    let parsedOptions: string[] = Array.isArray(options) ? options : [];

    if (typeof options === "string") {
      try {
        parsedOptions = JSON.parse(options);
      } catch {
        return `Custom field "${fieldName}" has invalid dropdown options.`;
      }
    }

    if (!parsedOptions.includes(value.trim())) {
      return `Custom field "${fieldName}" expects one of: ${parsedOptions.join(", ")}, got "${value}".`;
    }
  }

  return null;
}

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
      options: customFieldDefinitionTable.options,
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

    const error = validateCustomFieldValue(
      cf.value,
      def.type as "number" | "boolean" | "date" | "dropdown",
      def.name,
      def.options,
    );

    if (error) {
      throw new HTTPException(400, { message: error });
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
