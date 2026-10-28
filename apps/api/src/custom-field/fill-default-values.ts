import { and, eq, isNull, or, sql } from "drizzle-orm";
import type db from "../database";
import { customFieldValueTable, taskTable } from "../database/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type FillInput = {
  projectId: string;
  fieldId: string;
  value: string;
};

const CHUNK_SIZE = 500;

export async function insertMissingValues(
  tx: Transaction,
  { projectId, fieldId, value }: FillInput,
) {
  const tasks = await tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));

  for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
    await tx
      .insert(customFieldValueTable)
      .values(
        tasks.slice(i, i + CHUNK_SIZE).map((task) => ({
          taskId: task.id,
          fieldId,
          value,
        })),
      )
      .onConflictDoNothing();
  }
}

export async function fillEmptyValues(tx: Transaction, input: FillInput) {
  await insertMissingValues(tx, input);
  await tx
    .update(customFieldValueTable)
    .set({ value: input.value })
    .where(
      and(
        eq(customFieldValueTable.fieldId, input.fieldId),
        or(
          isNull(customFieldValueTable.value),
          sql`trim(${customFieldValueTable.value}) in ('', '[]')`,
        ),
      ),
    );
}
