import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../../database";
import type { AgentSubject } from "../../types";
import { getOwnedAutomation } from "../access";

export async function deleteAutomation(subject: AgentSubject, id: string) {
  await getOwnedAutomation(subject, id);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.agentAutomationTable)
      .where(
        and(
          eq(schema.agentAutomationTable.id, id),
          eq(schema.agentAutomationTable.ownerId, subject.userId),
        ),
      )
      .for("update");
    if (!row) throw new HTTPException(404, { message: "Automation not found" });
    const conversations = tx
      .select({ id: schema.agentConversationTable.id })
      .from(schema.agentConversationTable)
      .where(eq(schema.agentConversationTable.automationId, id));
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
          inArray(schema.agentRunTable.conversationId, conversations),
          inArray(schema.agentRunTable.status, ["queued", "running"]),
        ),
      );
    await tx
      .delete(schema.agentAutomationTable)
      .where(eq(schema.agentAutomationTable.id, id));
    return { id };
  });
}
