import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";

async function setCustomFieldValue(
  taskId: string,
  fieldId: string,
  value: string,
) {
  const [task] = await db
    .select({
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [field] = await db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.id, fieldId))
    .limit(1);

  if (!field || field.projectId !== task.projectId) {
    throw new HTTPException(404, {
      message: "Custom field not found",
    });
  }

  const normalizedValue = value.trim();

  if (field.required && normalizedValue.length === 0) {
    throw new HTTPException(400, {
      message: "This custom field is required",
    });
  }

  if (
    field.type === "dropdown" &&
    normalizedValue.length > 0 &&
    Array.isArray(field.options) &&
    !field.options.includes(normalizedValue)
  ) {
    throw new HTTPException(400, {
      message: "Invalid option for this custom field",
    });
  }

  if (
    field.type === "number" &&
    normalizedValue.length > 0 &&
    Number.isNaN(Number(normalizedValue))
  ) {
    throw new HTTPException(400, {
      message: "Value must be a valid number",
    });
  }

  if (
    field.type === "boolean" &&
    normalizedValue.length > 0 &&
    normalizedValue !== "true" &&
    normalizedValue !== "false"
  ) {
    throw new HTTPException(400, {
      message: "Value must be true or false",
    });
  }

  const [result] = await db
    .insert(customFieldValueTable)
    .values({
      taskId,
      fieldId,
      value: normalizedValue,
    })
    .onConflictDoUpdate({
      target: [customFieldValueTable.taskId, customFieldValueTable.fieldId],
      set: {
        value: sql`excluded.value`,
      },
    })
    .returning();

  return result;
}

export default setCustomFieldValue;
