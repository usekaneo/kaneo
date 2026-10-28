import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { AgentSubject } from "../types";

// Only the uploader can read an attachment, matching run privacy.
export async function getAttachmentContent(
  subject: AgentSubject,
  attachmentId: string,
) {
  const [attachment] = await db
    .select({
      id: schema.agentAttachmentTable.id,
      name: schema.agentAttachmentTable.name,
      mediaType: schema.agentAttachmentTable.mediaType,
      size: schema.agentAttachmentTable.size,
      data: schema.agentAttachmentTable.data,
    })
    .from(schema.agentAttachmentTable)
    .where(
      and(
        eq(schema.agentAttachmentTable.id, attachmentId),
        eq(schema.agentAttachmentTable.userId, subject.userId),
        eq(schema.agentAttachmentTable.workspaceId, subject.workspaceId),
      ),
    )
    .limit(1);
  if (!attachment)
    throw new HTTPException(404, { message: "Attachment not found" });
  return attachment;
}
