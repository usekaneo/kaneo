import { ApiError } from "../../errors/api-error";
import { aiBillingEnabled } from "../../billing/ai/config";
import { initializeWallet } from "../../billing/ai/wallet";
import { and, eq, inArray, count, gte, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { getOwnedConversation } from "../access";
import { requireEffectiveAgentConfig } from "../effective-config";
import {
  type AgentRunAttachmentInput,
  toRunAttachmentInput,
  uploadIds,
} from "../run-request-attachments";
import type { AgentAttachment, AgentSubject } from "../types";

export async function createRun(
  subject: AgentSubject,
  conversationId: string,
  input: {
    requestId: string;
    prompt: string;
    attachments: AgentRunAttachmentInput[];
    model?: string;
  },
) {
  const config = await requireEffectiveAgentConfig();
  const model = input.model ?? config.model;
  if (!config.models.includes(model))
    throw new HTTPException(400, {
      message: "Model is not available on this instance",
    });
  const conversation = await getOwnedConversation(subject, conversationId);
  if (conversation.automationId)
    throw new HTTPException(409, {
      message: "Use the automation run endpoint",
    });
  return db.transaction(async (tx) => {
    // Serialize user-wide rate limits across conversations and API instances.
    await tx
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, subject.userId))
      .for("update");
    const [existing] = await tx
      .select()
      .from(schema.agentRunTable)
      .where(
        and(
          eq(schema.agentRunTable.conversationId, conversationId),
          eq(schema.agentRunTable.requestId, input.requestId),
        ),
      )
      .limit(1);
    if (existing) {
      // Mentions must match the prompt's tokens, so comparing prompts also
      // compares mentions.
      if (
        existing.prompt !== input.prompt ||
        existing.model !== model ||
        JSON.stringify(toRunAttachmentInput(existing.attachments)) !==
          JSON.stringify(input.attachments)
      )
        throw new HTTPException(409, {
          message: "Request ID already used for another prompt",
        });
      return { id: existing.id, status: existing.status };
    }
    if (aiBillingEnabled()) {
      const wallet = await initializeWallet(subject.workspaceId, tx);
      if (wallet.balance <= wallet.reserved)
        throw new ApiError(402, {
          code: "AI_CREDIT_REQUIRED",
          message:
            "AI balance depleted or reserved. Add credit in workspace billing.",
        });
    }
    const [conversationActive] = await tx
      .select({ id: schema.agentRunTable.id })
      .from(schema.agentRunTable)
      .where(
        and(
          eq(schema.agentRunTable.conversationId, conversationId),
          inArray(schema.agentRunTable.status, ["queued", "running"]),
        ),
      )
      .limit(1);
    if (conversationActive)
      throw new HTTPException(409, {
        message: "Conversation already has an active run",
      });
    const conversationIds = tx
      .select({ id: schema.agentConversationTable.id })
      .from(schema.agentConversationTable)
      .where(eq(schema.agentConversationTable.userId, subject.userId));
    const [active] = await tx
      .select({ value: count() })
      .from(schema.agentRunTable)
      .where(
        and(
          inArray(schema.agentRunTable.conversationId, conversationIds),
          inArray(schema.agentRunTable.status, ["queued", "running"]),
        ),
      );
    const [recent] = await tx
      .select({ value: count() })
      .from(schema.agentRunTable)
      .where(
        and(
          inArray(schema.agentRunTable.conversationId, conversationIds),
          gte(schema.agentRunTable.createdAt, new Date(Date.now() - 60000)),
        ),
      );
    if ((active?.value ?? 0) >= 2 || (recent?.value ?? 0) >= 10)
      throw new HTTPException(429, {
        message: "Agent run limit reached; try again later",
      });
    const ids = uploadIds(input.attachments);
    // Only your own unsent uploads in this workspace can be referenced; any
    // other ID looks missing so upload IDs cannot be probed.
    const uploads = ids.length
      ? await tx
          .select({
            id: schema.agentAttachmentTable.id,
            name: schema.agentAttachmentTable.name,
            mediaType: schema.agentAttachmentTable.mediaType,
            size: schema.agentAttachmentTable.size,
          })
          .from(schema.agentAttachmentTable)
          .where(
            and(
              inArray(schema.agentAttachmentTable.id, ids),
              eq(schema.agentAttachmentTable.userId, subject.userId),
              eq(schema.agentAttachmentTable.workspaceId, subject.workspaceId),
              isNull(schema.agentAttachmentTable.runId),
            ),
          )
          .for("update")
      : [];
    if (uploads.length !== ids.length)
      throw new HTTPException(404, { message: "Attachment not found" });
    const byId = new Map(uploads.map((upload) => [upload.id, upload]));
    const attachments: AgentAttachment[] = input.attachments.map((file) =>
      "id" in file ? (byId.get(file.id) as AgentAttachment) : file,
    );
    const [run] = await tx
      .insert(schema.agentRunTable)
      .values({
        conversationId,
        requestId: input.requestId,
        prompt: input.prompt,
        attachments,
        model,
        touchedProjectIds: conversation.projectId
          ? [conversation.projectId]
          : [],
      })
      .returning();
    if (!run) throw new HTTPException(500, { message: "Could not queue run" });
    if (ids.length)
      await tx
        .update(schema.agentAttachmentTable)
        .set({ runId: run.id })
        .where(inArray(schema.agentAttachmentTable.id, ids));
    await tx
      .update(schema.agentConversationTable)
      .set({ updatedAt: new Date() })
      .where(eq(schema.agentConversationTable.id, conversationId));
    return { id: run.id, status: run.status };
  });
}
