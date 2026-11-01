import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { getOwnedConversation } from "../access";
import type { AgentSubject } from "../types";

export async function setConversationSharing(
  subject: AgentSubject,
  conversationId: string,
  shared: boolean,
) {
  const conversation = await getOwnedConversation(subject, conversationId);
  if (shared === Boolean(conversation.sharedAt)) return conversation;
  const [updated] = await db
    .update(schema.agentConversationTable)
    .set({
      sharedAt: shared ? new Date() : null,
      // Sharing is not activity; keep the history order unchanged.
      updatedAt: conversation.updatedAt,
    })
    .where(eq(schema.agentConversationTable.id, conversationId))
    .returning();
  return updated ?? conversation;
}
