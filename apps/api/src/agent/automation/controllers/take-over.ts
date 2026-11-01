import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../../database";
import { assertAgentAccess } from "../../access";
import type { AgentSubject } from "../../types";
import { getVisibleAutomation } from "../access";
import { ensureAutomationConversation } from "../ensure-conversation";

export async function takeOverAutomation(subject: AgentSubject, id: string) {
  const visible = await getVisibleAutomation(subject, id);
  if (!visible.admin)
    throw new HTTPException(403, {
      message: "Automation management permission required",
    });
  await assertAgentAccess({
    ...subject,
    projectId: visible.automation.projectId,
  });
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.agentAutomationTable)
      .where(eq(schema.agentAutomationTable.id, id))
      .for("update");
    if (!row) throw new HTTPException(404, { message: "Automation not found" });
    if (row.ownerId === subject.userId) return;
    const conversations = await tx
      .select({ id: schema.agentConversationTable.id })
      .from(schema.agentConversationTable)
      .where(eq(schema.agentConversationTable.automationId, id));
    // Revoke sharing on the old history. It stays owned by the original user.
    await tx
      .update(schema.agentConversationTable)
      .set({ sharedAt: null })
      .where(eq(schema.agentConversationTable.automationId, id));
    if (conversations.length)
      await tx
        .update(schema.agentRunTable)
        .set({
          status: "cancelled",
          finishedAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
        })
        .where(
          and(
            inArray(
              schema.agentRunTable.conversationId,
              conversations.map((c) => c.id),
            ),
            inArray(schema.agentRunTable.status, ["queued", "running"]),
          ),
        );
    const [updated] = await tx
      .update(schema.agentAutomationTable)
      .set({
        ownerId: subject.userId,
        enabled: false,
        pausedReason: null,
        consecutiveFailures: 0,
        nextRunAt: null,
        lastSkipReason: null,
      })
      .where(eq(schema.agentAutomationTable.id, id))
      .returning();
    await tx
      .update(schema.agentAutomationEventTable)
      .set({ consumedAt: new Date(), payload: null })
      .where(
        and(
          eq(schema.agentAutomationEventTable.automationId, id),
          isNull(schema.agentAutomationEventTable.consumedAt),
        ),
      );
    await ensureAutomationConversation(tx, updated!);
  });
}
