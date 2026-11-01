import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { getVisibleRun } from "../access";
import type { AgentSubject } from "../types";

// The uploader can always read an attachment. Others can read it only through
// a sent run they can currently see, i.e. one in a conversation shared with them.
export async function getAttachmentContent(
  subject: AgentSubject,
  attachmentId: string,
) {
  const [attachment] = await db
    .select({
      id: schema.agentAttachmentTable.id,
      userId: schema.agentAttachmentTable.userId,
      runId: schema.agentAttachmentTable.runId,
      name: schema.agentAttachmentTable.name,
      mediaType: schema.agentAttachmentTable.mediaType,
      size: schema.agentAttachmentTable.size,
      data: schema.agentAttachmentTable.data,
    })
    .from(schema.agentAttachmentTable)
    .where(
      and(
        eq(schema.agentAttachmentTable.id, attachmentId),
        eq(schema.agentAttachmentTable.workspaceId, subject.workspaceId),
      ),
    )
    .limit(1);
  const notFound = new HTTPException(404, { message: "Attachment not found" });
  if (!attachment) throw notFound;
  const { userId, runId, ...content } = attachment;
  if (userId === subject.userId) return { ...content, shared: false };
  if (!runId) throw notFound;
  await getVisibleRun(subject, runId).catch((error: unknown) => {
    throw error instanceof HTTPException ? notFound : error;
  });
  return { ...content, shared: true };
}
