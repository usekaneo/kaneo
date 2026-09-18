import { eq, max } from "drizzle-orm";
import { Effect } from "effect";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";
import { Database } from "../../effect/database";
import { projectById } from "../../effect/lookups";
import {
  CustomFieldCreateFailed,
  InvalidCustomFieldDefinition,
} from "../errors";

function validateDefaultValue(
  type: string,
  defaultValue: string | undefined,
  options: string[] | undefined,
) {
  if (defaultValue === undefined || defaultValue === null) {
    return undefined;
  }

  const trimmedValue = defaultValue.trim();
  if (!trimmedValue) {
    return undefined;
  }

  if (type === "number") {
    const numberRegex = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;
    if (!numberRegex.test(trimmedValue)) {
      return "number-default";
    }
    const parsed = Number(trimmedValue);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      return "number-default";
    }
  } else if (type === "boolean") {
    if (trimmedValue !== "true" && trimmedValue !== "false") {
      return "boolean-default";
    }
  } else if (type === "date") {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(trimmedValue)) {
      const parsedDate = new Date(trimmedValue);
      if (Number.isNaN(parsedDate.getTime())) {
        return "date-default";
      }
    }
  } else if (type === "dropdown") {
    if (options && options.length > 0) {
      const normalizedOptions = options.map((opt) => opt.trim());
      if (!normalizedOptions.includes(trimmedValue)) {
        return "dropdown-default";
      }
    }
  }

  return undefined;
}

const createCustomField = Effect.fn("customField.createCustomField")(function* (
  projectId: string,
  name: string,
  type: string,
  required: boolean,
  defaultValue?: string,
  options?: string[],
) {
  const database = yield* Database;

  yield* projectById(projectId);

  if (
    required &&
    (defaultValue === undefined ||
      defaultValue === null ||
      defaultValue.trim() === "")
  ) {
    return yield* new InvalidCustomFieldDefinition({
      reason: "required-default",
    });
  }

  const invalidDefault = validateDefaultValue(type, defaultValue, options);
  if (invalidDefault) {
    return yield* new InvalidCustomFieldDefinition({ reason: invalidDefault });
  }

  if (type === "dropdown" && (!options || options.length === 0)) {
    return yield* new InvalidCustomFieldDefinition({
      reason: "dropdown-options",
    });
  }

  const [maxPositionResult] = yield* database.query((db) =>
    db
      .select({ maxPosition: max(customFieldDefinitionTable.position) })
      .from(customFieldDefinitionTable)
      .where(eq(customFieldDefinitionTable.projectId, projectId)),
  );

  return yield* database.transaction((tx) =>
    Effect.gen(function* () {
      const [created] = yield* tx.query((db) =>
        db
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
          .returning(),
      );

      if (!created) {
        return yield* new CustomFieldCreateFailed({ projectId });
      }

      if (defaultValue != null && defaultValue.trim() !== "") {
        const tasks = yield* tx.query((db) =>
          db
            .select({ id: taskTable.id })
            .from(taskTable)
            .where(eq(taskTable.projectId, projectId)),
        );

        const CHUNK_SIZE = 500;
        for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
          const chunk = tasks.slice(i, i + CHUNK_SIZE);
          yield* tx.query((db) =>
            db
              .insert(customFieldValueTable)
              .values(
                chunk.map((task) => ({
                  taskId: task.id,
                  fieldId: created.id,
                  value: defaultValue,
                })),
              )
              .onConflictDoNothing(),
          );
        }
      }

      return created;
    }),
  );
});

export default createCustomField;
