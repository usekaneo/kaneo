import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "../../database/schema";
import type { z } from "../../openapi";
import { withoutHiddenOptions } from "../hidden-options";
import type { updateCustomFieldBody } from "../schema";

export default async function updateCustomField(
  id: string,
  input: z.infer<typeof updateCustomFieldBody>,
) {
  return db.transaction(async (tx) => {
    const [field] = await tx
      .select()
      .from(customFieldDefinitionTable)
      .where(eq(customFieldDefinitionTable.id, id))
      .for("update");
    if (!field)
      throw new HTTPException(404, { message: "Custom field not found" });
    if (field.updatedAt.toISOString() !== input.updatedAt) {
      throw new HTTPException(409, {
        message: "This field has changed. Close the editor and try again.",
      });
    }

    let options = field.options;
    let defaultValue = field.defaultValue;
    let hiddenOptions = field.hiddenOptions;
    if (input.options !== undefined) {
      if (field.type !== "dropdown" && field.type !== "multiselect") {
        throw new HTTPException(400, {
          message: "Only selection fields have options",
        });
      }
      const oldOptions = Array.isArray(field.options)
        ? (field.options as string[])
        : [];
      const originalValues = input.options.flatMap((option) =>
        option.originalValue === undefined ? [] : [option.originalValue],
      );
      const newOptions = input.options.map((option) => option.value);
      if (
        new Set(originalValues).size !== originalValues.length ||
        originalValues.some((value) => !oldOptions.includes(value))
      ) {
        throw new HTTPException(400, { message: "Invalid original options" });
      }
      if (new Set(newOptions).size !== newOptions.length) {
        throw new HTTPException(400, {
          message: "Option names must be unique",
        });
      }
      if (newOptions.length < (field.type === "multiselect" ? 2 : 1)) {
        throw new HTTPException(400, {
          message: "Not enough options for this field type",
        });
      }
      hiddenOptions = input.options
        .filter(
          (option) =>
            option.hidden ??
            (option.originalValue !== undefined &&
              field.hiddenOptions.includes(option.originalValue)),
        )
        .map((option) => option.value);
      if (
        field.required &&
        newOptions.every((option) => hiddenOptions.includes(option))
      ) {
        throw new HTTPException(400, {
          message: "Required fields must have at least one visible option",
        });
      }
      const replacements = new Map(
        input.options.flatMap((option) =>
          option.originalValue === undefined
            ? []
            : [[option.originalValue, option.value] as const],
        ),
      );
      const transform = (value: string | null): string | null => {
        if (value === null || value.trim() === "") return value;
        const replace = (selected: string) => {
          const replacement = replacements.get(selected);
          if (replacement === undefined) {
            throw new HTTPException(400, {
              message:
                "Cannot remove an option used by a task or the default value",
            });
          }
          return replacement;
        };
        if (field.type === "dropdown") return replace(value.trim());
        let selected: unknown;
        try {
          selected = JSON.parse(value);
        } catch {
          throw new HTTPException(400, {
            message: "An existing selection is invalid",
          });
        }
        if (
          !Array.isArray(selected) ||
          selected.some((item) => typeof item !== "string")
        ) {
          throw new HTTPException(400, {
            message: "An existing selection is invalid",
          });
        }
        return JSON.stringify(selected.map(replace));
      };
      defaultValue = transform(defaultValue);
      if (defaultValue !== null) {
        defaultValue =
          withoutHiddenOptions(defaultValue, field.type, hiddenOptions) || null;
      }
      const needsMigration = oldOptions.some(
        (option) => replacements.get(option) !== option,
      );
      const values = needsMigration
        ? await tx
            .select()
            .from(customFieldValueTable)
            .where(eq(customFieldValueTable.fieldId, id))
            .for("update")
        : [];
      const changed = values
        .map((row) => ({
          id: row.id,
          before: row.value,
          value: transform(row.value),
        }))
        .filter((row) => row.before !== row.value);
      // Batch updates preserve simultaneous renames (including swaps) without a query per task.
      for (let i = 0; i < changed.length; i += 500) {
        const rows = changed
          .slice(i, i + 500)
          .map((row) => sql`(${row.id}::text, ${row.value}::text)`);
        await tx.execute(sql`UPDATE ${customFieldValueTable} AS target SET value = changes.value
          FROM (VALUES ${sql.join(rows, sql`, `)}) AS changes(id, value)
          WHERE target.id = changes.id`);
      }
      options = newOptions;
    }
    const [updated] = await tx
      .update(customFieldDefinitionTable)
      .set({
        name: input.name,
        options,
        hiddenOptions,
        defaultValue,
        updatedAt: new Date(),
      })
      .where(eq(customFieldDefinitionTable.id, id))
      .returning();
    if (!updated)
      throw new HTTPException(404, { message: "Custom field not found" });
    return updated;
  });
}
