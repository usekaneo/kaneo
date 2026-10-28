import { createId } from "@paralleldrive/cuid2";
import { asc, eq } from "drizzle-orm";
import type db from "../../database";
import { columnTable } from "../../database/schema";
import { chunk } from "./chunk";
import type { ImportColumnPlan } from "./plan-import-columns";
import type { BoardColumn } from "./plan-import-tasks";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ImportBoard = {
  byKey: Map<string, BoardColumn>;
  fallback: BoardColumn | null;
  count: number;
};

export async function writeImportColumns(
  tx: Transaction,
  projectId: string,
  plan: ImportColumnPlan,
): Promise<ImportBoard> {
  if (plan.columns.length === 0) {
    const defaults = await tx
      .select({ id: columnTable.id, slug: columnTable.slug })
      .from(columnTable)
      .where(eq(columnTable.projectId, projectId))
      .orderBy(asc(columnTable.position));
    return {
      byKey: new Map(),
      fallback: defaults[0] ?? null,
      count: defaults.length,
    };
  }

  await tx.delete(columnTable).where(eq(columnTable.projectId, projectId));

  const planned = plan.columns.map((column) => ({
    key: column.key,
    row: {
      id: createId(),
      projectId,
      name: column.name,
      slug: column.slug,
      position: column.position,
      isFinal: column.isFinal,
    },
  }));
  for (const batch of chunk(planned.map(({ row }) => row))) {
    await tx.insert(columnTable).values(batch);
  }

  const byKey = new Map(
    planned.map(({ key, row }) => [key, { id: row.id, slug: row.slug }]),
  );
  const first = planned[0]?.row;
  return {
    byKey,
    fallback: first ? { id: first.id, slug: first.slug } : null,
    count: planned.length,
  };
}
