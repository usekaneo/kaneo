import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { checkOwnerAccess } from "./owner-access";
import { monthlyWorkspaceCost } from "./queue-run";
import { parseMonthlyBudget } from "./limits";
import { pauseAutomation, recordSkip } from "./pause";

// Queue-time grants and budget checks may be stale when a worker claims a run.
// Cancel a stale job without counting an infrastructure/access skip as a model failure.
export async function prepareAutomationRun(
  run: typeof schema.agentRunTable.$inferSelect,
  conversation: typeof schema.agentConversationTable.$inferSelect,
  leaseOwner: string,
  allowedModels: string[],
) {
  if (!run.trigger) return true;
  const [automation] = await db
    .select()
    .from(schema.agentAutomationTable)
    .where(eq(schema.agentAutomationTable.id, run.trigger.automationId));
  const access = automation ? await checkOwnerAccess(automation) : "lost";
  const unavailable =
    !automation ||
    automation.ownerId !== conversation.userId ||
    automation.projectId !== conversation.projectId ||
    !automation.enabled ||
    access !== "ok";
  if (automation && access === "lost")
    await pauseAutomation(db, automation.id, "owner_access");
  const budget = parseMonthlyBudget(
    process.env.KANEO_AGENT_WORKSPACE_MONTHLY_USD,
  );
  const skip = unavailable
    ? null
    : budget !== null &&
        (await monthlyWorkspaceCost(
          db,
          conversation.workspaceId,
          new Date(),
        )) >= budget
      ? "budget"
      : !allowedModels.includes(run.model)
        ? "unavailable"
        : null;
  if (!unavailable && !skip) return true;
  if (automation && skip) await recordSkip(db, automation.id, skip);
  await db
    .update(schema.agentRunTable)
    .set({
      status: "cancelled",
      error: skip
        ? `Automation run skipped: ${skip}`
        : "Automation no longer available",
      finishedAt: new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(
      and(
        eq(schema.agentRunTable.id, run.id),
        eq(schema.agentRunTable.status, "running"),
        eq(schema.agentRunTable.leaseOwner, leaseOwner),
      ),
    );
  return false;
}
