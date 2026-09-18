import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { customFieldValueTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { NotFound } from "../../effect/errors";
import { customFieldById, taskRefById } from "../../effect/lookups";
import { InvalidCustomFieldValue } from "../errors";

const setCustomFieldValue = Effect.fn("customField.setCustomFieldValue")(
  function* (taskId: string, fieldId: string, value: string) {
    const database = yield* Database;

    const task = yield* taskRefById(taskId);
    const field = yield* customFieldById(fieldId);

    if (field.projectId !== task.projectId) {
      return yield* new NotFound({ entity: "Custom field", id: fieldId });
    }

    const normalizedValue = value.trim();

    if (field.required && normalizedValue.length === 0) {
      return yield* new InvalidCustomFieldValue({
        fieldId,
        reason: "required",
      });
    }

    if (
      field.type === "dropdown" &&
      normalizedValue.length > 0 &&
      Array.isArray(field.options) &&
      !field.options.includes(normalizedValue)
    ) {
      return yield* new InvalidCustomFieldValue({ fieldId, reason: "option" });
    }

    if (
      field.type === "number" &&
      normalizedValue.length > 0 &&
      Number.isNaN(Number(normalizedValue))
    ) {
      return yield* new InvalidCustomFieldValue({ fieldId, reason: "number" });
    }

    if (
      field.type === "boolean" &&
      normalizedValue.length > 0 &&
      normalizedValue !== "true" &&
      normalizedValue !== "false"
    ) {
      return yield* new InvalidCustomFieldValue({ fieldId, reason: "boolean" });
    }

    const [result] = yield* database.query((db) =>
      db
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
        .returning(),
    );

    return result;
  },
);

export default setCustomFieldValue;
