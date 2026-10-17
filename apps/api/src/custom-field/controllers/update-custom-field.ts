import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "../../database/schema";
import { isChoiceType } from "../choice-options";
import { fillEmptyValues } from "../fill-default-values";
import { planChoiceValueChanges } from "../plan-choice-value-changes";
import {
  type CustomFieldUpdateInput,
  resolveFieldUpdate,
} from "../resolve-field-update";

async function updateCustomField(id: string, input: CustomFieldUpdateInput) {
  return db.transaction(async (tx) => {
    const [field] = await tx
      .select()
      .from(customFieldDefinitionTable)
      .where(eq(customFieldDefinitionTable.id, id))
      .limit(1)
      .for("update");

    if (!field) {
      throw new HTTPException(404, { message: "Custom field not found" });
    }

    const next = resolveFieldUpdate(field, input);

    if (
      isChoiceType(field.type) &&
      isChoiceType(next.type) &&
      (next.removedOptions.length > 0 || next.type !== field.type)
    ) {
      const rows = await tx
        .selectDistinct({ value: customFieldValueTable.value })
        .from(customFieldValueTable)
        .where(eq(customFieldValueTable.fieldId, id));

      const changes = planChoiceValueChanges({
        values: rows.map((row) => row.value),
        from: field.type,
        to: next.type,
        removedOptions: next.removedOptions,
      });

      if (changes.length > 0) {
        const cases = sql.join(
          changes.map((change) => sql`when ${change.from} then ${change.to}`),
          sql` `,
        );
        await tx
          .update(customFieldValueTable)
          .set({ value: sql`case ${customFieldValueTable.value} ${cases} end` })
          .where(
            and(
              eq(customFieldValueTable.fieldId, id),
              inArray(
                customFieldValueTable.value,
                changes.map((change) => change.from),
              ),
            ),
          );
      }
    }

    const [updated] = await tx
      .update(customFieldDefinitionTable)
      .set({
        name: next.name,
        type: next.type,
        required: next.required,
        defaultValue: next.defaultValue,
        options: next.options,
      })
      .where(eq(customFieldDefinitionTable.id, id))
      .returning();

    if (!updated) {
      throw new HTTPException(404, { message: "Custom field not found" });
    }

    if (next.required && !field.required && next.defaultValue !== null) {
      await fillEmptyValues(tx, {
        projectId: field.projectId,
        fieldId: id,
        value: next.defaultValue,
      });
    }

    return updated;
  });
}

export default updateCustomField;
