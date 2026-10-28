import { and, isNull, lt } from "drizzle-orm";
import db, { schema } from "../database";

// Uploads never sent with a run expire after a day.
export async function cleanupPendingAgentUploads() {
  await db
    .delete(schema.agentAttachmentTable)
    .where(
      and(
        isNull(schema.agentAttachmentTable.runId),
        lt(
          schema.agentAttachmentTable.createdAt,
          new Date(Date.now() - 24 * 60 * 60 * 1000),
        ),
      ),
    );
}
