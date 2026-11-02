import { and, eq, inArray } from "drizzle-orm";
import { schema } from "../../database";
import type { AgentDatabase } from "../access";

// Called inside the automation edit transaction, before clearing ownership.
export async function cancelAutomationRuns(
  tx: AgentDatabase,
  automationId: string,
  now = new Date(),
) {
  const conversations = tx
    .select({ id: schema.agentConversationTable.id })
    .from(schema.agentConversationTable)
    .where(eq(schema.agentConversationTable.automationId, automationId));
  const cancelled = await tx
    .update(schema.agentRunTable)
    .set({
      status: "cancelled",
      finishedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(
      and(
        inArray(schema.agentRunTable.conversationId, conversations),
        inArray(schema.agentRunTable.status, ["queued", "running"]),
      ),
    )
    .returning({ id: schema.agentRunTable.id });
  if (!cancelled.length) return;
  const ids = cancelled.map((run) => run.id);
  await tx
    .update(schema.agentProposalTable)
    .set({ status: "discarded" })
    .where(
      and(
        inArray(schema.agentProposalTable.runId, ids),
        eq(schema.agentProposalTable.status, "pending"),
      ),
    );
  await tx
    .update(schema.agentStepTable)
    .set({ status: "failed", summary: "Run cancelled", finishedAt: now })
    .where(
      and(
        inArray(schema.agentStepTable.runId, ids),
        eq(schema.agentStepTable.status, "running"),
      ),
    );
}
