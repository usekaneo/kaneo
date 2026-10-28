import { and, eq, inArray, count, gte } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { getOwnedConversation } from "../access";
import { requireAgentConfig } from "../config";
import type { AgentAttachment, AgentSubject } from "../types";

export async function createRun(
  subject: AgentSubject,
  conversationId: string,
  input: {
    requestId: string;
    prompt: string;
    attachments: AgentAttachment[];
    model?: string;
  },
) {
  const config = requireAgentConfig();
  const model = input.model ?? config.model;
  if (!config.models.includes(model))
    throw new HTTPException(400, {
      message: "Model is not available on this instance",
    });
  await getOwnedConversation(subject, conversationId);
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
      if (
        existing.prompt !== input.prompt ||
        JSON.stringify(existing.attachments) !==
          JSON.stringify(input.attachments)
      )
        throw new HTTPException(409, {
          message: "Request ID already used for another prompt",
        });
      return { id: existing.id, status: existing.status };
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
    const [run] = await tx
      .insert(schema.agentRunTable)
      .values({
        conversationId,
        requestId: input.requestId,
        prompt: input.prompt,
        attachments: input.attachments,
        model,
      })
      .returning();
    if (!run) throw new HTTPException(500, { message: "Could not queue run" });
    await tx
      .update(schema.agentConversationTable)
      .set({ updatedAt: new Date() })
      .where(eq(schema.agentConversationTable.id, conversationId));
    return { id: run.id, status: run.status };
  });
}
