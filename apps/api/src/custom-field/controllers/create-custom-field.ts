import { eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  projectTable,
  taskTable,
} from "../../database/schema";

import {
  isCustomFieldValueEmpty,
  validateCustomFieldValue,
} from "../../task/validate-task-fields";

async function createCustomField(
  projectId: string,
  name: string,
  type: string,
  required: boolean,
  defaultValue?: string,
  options?: string[],
) {
  if (!name.trim())
    throw new HTTPException(400, { message: "Name cannot be empty" });

  const [project] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  if (
    required &&
    (defaultValue === undefined ||
      defaultValue === null ||
      defaultValue.trim() === "")
  ) {
    throw new HTTPException(400, {
      message: "Required fields must have a default value",
    });
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
        const error = validateCustomFieldValue(trimmedValue, "date", name);
        if (error) {
          throw new HTTPException(400, { message: error });
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

  if (type === "dropdown" && (!options || options.length < 1)) {
    throw new HTTPException(400, {
      message: "Dropdown fields must have at least one option",
    });
  }

  if (type === "multiselect") {
    const normalizedOptions = Array.from(
      new Set(
        (options ?? [])
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 0),
      ),
    );

    if (normalizedOptions.length < 2) {
      throw new HTTPException(400, {
        message: "Multiselect fields must have at least 2 options",
      });
    }
  }

  if (type === "multiselect" && defaultValue != null) {
    const empty = isCustomFieldValueEmpty(defaultValue, "multiselect");
    if (required && empty) {
      throw new HTTPException(400, {
        message: "Required fields must have a default value",
      });
    }
    if (!empty) {
      const error = validateCustomFieldValue(
        defaultValue,
        "multiselect",
        name,
        options,
      );
      if (error) {
        throw new HTTPException(400, { message: error });
      }
    }
  }

  const storedDefaultValue =
    type === "date" ? defaultValue?.trim() : defaultValue;

  const [maxPositionResult] = await db
    .select({ maxPosition: max(customFieldDefinitionTable.position) })
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));

  const field = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(customFieldDefinitionTable)
      .values({
        projectId,
        name,
        type,
        required,
        defaultValue: storedDefaultValue ?? null,
        options: options ?? null,
        position: (maxPositionResult?.maxPosition ?? 0) + 1,
      })
      .returning();

    if (!created) {
      throw new HTTPException(500, {
        message: "Failed to create custom field",
      });
    }

    if (storedDefaultValue != null && storedDefaultValue.trim() !== "") {
      const tasks = await tx
        .select({ id: taskTable.id })
        .from(taskTable)
        .where(eq(taskTable.projectId, projectId));

      const CHUNK_SIZE = 500;
      for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
        await tx
          .insert(customFieldValueTable)
          .values(
            tasks.slice(i, i + CHUNK_SIZE).map((task) => ({
              taskId: task.id,
              fieldId: created.id,
              value: storedDefaultValue,
            })),
          )
          .onConflictDoNothing();
      }
    }

    return created;
  });

  return field;
}

export default createCustomField;
