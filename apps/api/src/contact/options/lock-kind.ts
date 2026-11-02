import { and, asc, eq } from "drizzle-orm";
import type db from "../../database";
import { contactOptionTable } from "../../database/schema";
import type { ContactOptionKind } from "./defaults";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Locks every option of a kind until the transaction ends, so concurrent
// creates, reorders, and deletes of the same list run one at a time.
export function lockKind(
  tx: Transaction,
  workspaceId: string,
  kind: ContactOptionKind,
) {
  return tx
    .select()
    .from(contactOptionTable)
    .where(
      and(
        eq(contactOptionTable.workspaceId, workspaceId),
        eq(contactOptionTable.kind, kind),
      ),
    )
    .orderBy(asc(contactOptionTable.position), asc(contactOptionTable.id))
    .for("update");
}
