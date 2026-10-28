import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { apikeyTable } from "../../database/schema";
import { findAdminTargetUser } from "../find-admin-target-user";

const iso = (date: Date | null) => (date ? date.toISOString() : null);

/** A user's API keys as metadata only: never the key or its hash. */
async function listUserApiKeys(userId: string) {
  await findAdminTargetUser(db, userId);
  const rows = await db
    .select({
      id: apikeyTable.id,
      name: apikeyTable.name,
      start: apikeyTable.start,
      enabled: apikeyTable.enabled,
      createdAt: apikeyTable.createdAt,
      lastRequest: apikeyTable.lastRequest,
      expiresAt: apikeyTable.expiresAt,
    })
    .from(apikeyTable)
    .where(eq(apikeyTable.referenceId, userId))
    .orderBy(desc(apikeyTable.createdAt), desc(apikeyTable.id));

  return {
    apiKeys: rows.map((row) => ({
      id: row.id,
      name: row.name,
      start: row.start,
      enabled: row.enabled ?? true,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: iso(row.lastRequest),
      expiresAt: iso(row.expiresAt),
    })),
  };
}

export default listUserApiKeys;
