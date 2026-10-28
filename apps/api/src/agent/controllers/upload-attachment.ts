import { and, count, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { requireAgentConfig } from "../config";
import {
  type AgentUploadMediaType,
  decodeAgentUpload,
  InvalidAgentUploadError,
} from "../decode-upload";
import { AGENT_ATTACHMENT_LIMITS } from "../schema";
import type { AgentSubject } from "../types";

export async function uploadAttachment(
  subject: AgentSubject,
  input: { name: string; mediaType: AgentUploadMediaType; data: string },
) {
  requireAgentConfig();
  let data: Buffer;
  try {
    data = decodeAgentUpload(input.mediaType, input.data);
  } catch (error) {
    if (error instanceof InvalidAgentUploadError)
      throw new HTTPException(400, { message: error.message });
    throw error;
  }
  return db.transaction(async (tx) => {
    // Serialize the pending-upload cap with run creation for this user.
    await tx
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, subject.userId))
      .for("update");
    const [pending] = await tx
      .select({ value: count() })
      .from(schema.agentAttachmentTable)
      .where(
        and(
          eq(schema.agentAttachmentTable.userId, subject.userId),
          isNull(schema.agentAttachmentTable.runId),
        ),
      );
    if ((pending?.value ?? 0) >= AGENT_ATTACHMENT_LIMITS.pendingUploads)
      throw new HTTPException(429, {
        message: "Too many unsent attachments; send or wait before uploading",
      });
    const [attachment] = await tx
      .insert(schema.agentAttachmentTable)
      .values({
        workspaceId: subject.workspaceId,
        userId: subject.userId,
        name: input.name,
        mediaType: input.mediaType,
        size: data.length,
        data,
      })
      .returning({
        id: schema.agentAttachmentTable.id,
        name: schema.agentAttachmentTable.name,
        mediaType: schema.agentAttachmentTable.mediaType,
        size: schema.agentAttachmentTable.size,
      });
    if (!attachment)
      throw new HTTPException(500, { message: "Could not store attachment" });
    return attachment;
  });
}
