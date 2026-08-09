import { eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  projectTable,
  taskTable,
} from "../../database/schema";

async function createCustomField(
  projectId: string,
  name: string,
  type: string,
  required: boolean,
  defaultValue?: string,
  options?: string[],
) {
  const [project] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  if (required && (defaultValue === undefined || defaultValue === null || defaultValue.trim() === "")) {
    throw new HTTPException(400, { message: "Required fields must have a default value" });
  }

  if (defaultValue !== undefined && defaultValue !== null) {
    const trimmedValue = defaultValue.trim();

    if (trimmedValue) {
      if (type === "number") {
        const numberRegex = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;
        if (!numberRegex.test(trimmedValue)) {
          throw new HTTPException(400, {
            message:
              "Default value must be a valid number for number type fields",
          });
        }
        const parsed = Number(trimmedValue);
        if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
          throw new HTTPException(400, {
            message:
              "Default value must be a valid number for number type fields",
          });
        }
      } else if (type === "boolean") {
        if (trimmedValue !== "true" && trimmedValue !== "false") {
          throw new HTTPException(400, {
            message:
              "Default value must be 'true' or 'false' for boolean type fields",
          });
        }
      } else if (type === "date") {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(trimmedValue)) {
          const parsedDate = new Date(trimmedValue);
          if (Number.isNaN(parsedDate.getTime())) {
            throw new HTTPException(400, {
              message:
                "Default value must be a valid date in ISO format (YYYY-MM-DD)",
            });
          }
        }
      } else if (type === "dropdown") {
        if (options && options.length > 0) {
          const normalizedOptions = options.map((opt) => opt.trim());
          if (!normalizedOptions.includes(trimmedValue)) {
            throw new HTTPException(400, {
              message: "Default value must be one of the dropdown options",
            });
          }
        }
      }
    }
  }

  if (type === "dropdown" && (!options || options.length === 0)) {
    throw new HTTPException(400, {
      message: "Dropdown fields must have at least one option",
    });
  }

  const [maxPositionResult] = await db
    .select({ maxPosition: max(customFieldDefinitionTable.position) })
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));

  const [field] = await db
    .insert(customFieldDefinitionTable)
    .values({
      projectId,
      name,
      type,
      required,
      defaultValue: defaultValue ?? null,
      options: options ?? null,
      position: (maxPositionResult?.maxPosition ?? 0) + 1,
    })
    .returning();

  if (!field) {
    throw new HTTPException(500, { message: "Failed to create custom field" });
  }

  if (defaultValue !== undefined && defaultValue !== null) {
    const tasks = await db
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(eq(taskTable.projectId, projectId));

    if (tasks.length > 0) {
      const valuesToInsert = tasks.map((task) => ({
        taskId: task.id,
        fieldId: field.id,
        value: defaultValue,
      }));

      await db
        .insert(customFieldValueTable)
        .values(valuesToInsert)
        .onConflictDoNothing();
    }
  }

  return field;
}

export default createCustomField;