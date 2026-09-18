import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { timeEntryTable } from "../database/schema";
import { hasWorkspacePermission } from "../utils/require-workspace-permission";

export async function canSeeEveryonesTime(c: Context) {
  return hasWorkspacePermission(c, { timeEntry: ["read_all"] });
}

// Your own entries are always yours to fix; anyone else's needs
// timeEntry:manage_all. Entries of removed users (userId null) fall in the
// second group.
export async function assertCanManageTimeEntry(c: Context, entryId: string) {
  const [entry] = await db
    .select({ userId: timeEntryTable.userId })
    .from(timeEntryTable)
    .where(eq(timeEntryTable.id, entryId));

  if (!entry) {
    throw new HTTPException(404, { message: "Time entry not found" });
  }

  if (entry.userId && entry.userId === c.get("userId")) return;

  if (await hasWorkspacePermission(c, { timeEntry: ["manage_all"] })) return;

  throw new HTTPException(403, {
    message: "You can only change your own time entries",
  });
}
