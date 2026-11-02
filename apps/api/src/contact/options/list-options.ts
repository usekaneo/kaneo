import { asc, count, eq } from "drizzle-orm";
import db from "../../database";
import { contactOptionTable, contactTable } from "../../database/schema";
import { columnForKind } from "./column-for-kind";
import type { ContactOptionKind } from "./defaults";
import { ensureDefaultOptions } from "./ensure-default-options";

async function countsFor(workspaceId: string, kind: ContactOptionKind) {
  const column = columnForKind(kind);
  const rows = await db
    .select({ key: column, total: count() })
    .from(contactTable)
    .where(eq(contactTable.workspaceId, workspaceId))
    .groupBy(column);
  return new Map(rows.map((row) => [row.key, row.total]));
}

async function listOptions(workspaceId: string) {
  await ensureDefaultOptions(workspaceId);
  const [rows, typeCounts, regionCounts] = await Promise.all([
    db
      .select()
      .from(contactOptionTable)
      .where(eq(contactOptionTable.workspaceId, workspaceId))
      .orderBy(asc(contactOptionTable.position), asc(contactOptionTable.id)),
    countsFor(workspaceId, "type"),
    countsFor(workspaceId, "region"),
  ]);
  const counts = { type: typeCounts, region: regionCounts };
  const ofKind = (kind: ContactOptionKind) =>
    rows
      .filter((row) => row.kind === kind)
      .map((row) => ({
        key: row.key,
        label: row.label,
        position: row.position,
        contactCount: counts[kind].get(row.key) ?? 0,
      }));
  return { types: ofKind("type"), regions: ofKind("region") };
}

export default listOptions;
