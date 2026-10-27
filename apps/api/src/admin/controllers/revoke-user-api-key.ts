import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { apikeyTable } from "../../database/schema";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findAdminTargetUser } from "../find-admin-target-user";

/**
 * Delete a user's API key, as the owner's own settings do. Requests with it
 * fail at once; open sockets stop receiving events at the next delivery check.
 */
async function revokeUserApiKey(
  { userId, apiKeyId }: { userId: string; apiKeyId: string },
  audit: AdminAuditRequest,
) {
  await db.transaction(async (tx) => {
    const user = await findAdminTargetUser(tx, userId);
    const [key] = await tx
      .delete(apikeyTable)
      .where(
        and(eq(apikeyTable.id, apiKeyId), eq(apikeyTable.referenceId, userId)),
      )
      .returning({ id: apikeyTable.id, name: apikeyTable.name });
    if (!key) throw new HTTPException(404, { message: "API key not found" });
    await recordAdminAction(
      {
        ...audit,
        action: "api_key.revoked",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
        metadata: { keyId: key.id, keyName: key.name },
      },
      tx,
    );
  });
  return { revoked: 1 };
}

export default revokeUserApiKey;
