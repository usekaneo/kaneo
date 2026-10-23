import { and, eq } from "drizzle-orm";
import db from "../../database";
import { pinnedLabelTable } from "../../database/schema";
import { workspaceLabelOrThrow } from "./workspace-label-or-throw";

export async function pinLabel(id: string, userId: string) {
  await workspaceLabelOrThrow(id);
  await db
    .insert(pinnedLabelTable)
    .values({ userId, labelId: id })
    .onConflictDoNothing();
  return { id, pinned: true };
}

export async function unpinLabel(id: string, userId: string) {
  await db
    .delete(pinnedLabelTable)
    .where(
      and(
        eq(pinnedLabelTable.userId, userId),
        eq(pinnedLabelTable.labelId, id),
      ),
    );
  return { id, pinned: false };
}
