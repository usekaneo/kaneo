import { and, count, eq } from "drizzle-orm";
import db from "../../database";
import { contactTable } from "../../database/schema";
import { columnForKind } from "./column-for-kind";
import type { ContactOptionKind } from "./defaults";

export async function countContactsUsing(
  workspaceId: string,
  kind: ContactOptionKind,
  key: string,
) {
  const [row] = await db
    .select({ total: count() })
    .from(contactTable)
    .where(
      and(
        eq(contactTable.workspaceId, workspaceId),
        eq(columnForKind(kind), key),
      ),
    );
  return row?.total ?? 0;
}
