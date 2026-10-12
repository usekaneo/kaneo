import type db from "../../database";
import { taskRelationTable } from "../../database/schema";
import { chunk } from "./chunk";
import type { PlannedImportRelation } from "./plan-import-relations";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function writeImportRelations(
  tx: Transaction,
  relations: readonly PlannedImportRelation[],
): Promise<number> {
  for (const batch of chunk(relations)) {
    await tx.insert(taskRelationTable).values(batch);
  }
  return relations.length;
}
