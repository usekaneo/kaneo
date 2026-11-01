import { and, eq, isNull } from "drizzle-orm";
import { schema } from "../../database";
import type { AgentDatabase } from "../access";

// Each owner gets one conversation per automation and scope. A new owner after a
// takeover starts a fresh one, so the previous owner's runs stay private.
export async function ensureAutomationConversation(
  database: AgentDatabase,
  automation: {
    id: string;
    workspaceId: string;
    ownerId: string;
    projectId: string | null;
    name: string;
  },
) {
  const values = {
    workspaceId: automation.workspaceId,
    userId: automation.ownerId,
    projectId: automation.projectId,
    title: automation.name,
    automationId: automation.id,
  };
  await database
    .insert(schema.agentConversationTable)
    .values(values)
    .onConflictDoNothing();
  const [conversation] = await database
    .select()
    .from(schema.agentConversationTable)
    .where(
      and(
        eq(schema.agentConversationTable.automationId, automation.id),
        eq(schema.agentConversationTable.userId, automation.ownerId),
        automation.projectId
          ? eq(schema.agentConversationTable.projectId, automation.projectId)
          : isNull(schema.agentConversationTable.projectId),
      ),
    )
    .limit(1);
  if (!conversation) throw new Error("Automation conversation missing");
  // Scope changes select another conversation; name edits update this one.
  if (conversation.title !== automation.name)
    await database
      .update(schema.agentConversationTable)
      .set({ title: automation.name })
      .where(eq(schema.agentConversationTable.id, conversation.id));
  return { ...conversation, projectId: automation.projectId };
}
