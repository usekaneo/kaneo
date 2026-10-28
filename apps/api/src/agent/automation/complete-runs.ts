import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import db, { schema } from "../../database";
import { persistNotification } from "../../notification/controllers/create-notification";
import { publishEvent } from "../../events";
import { AUTOMATION_FAILURES_BEFORE_PAUSE } from "./limits";
import { checkOwnerAccess } from "./owner-access";
import { pauseAutomation } from "./pause";

// Polling is a durable completion hook, including expired worker leases. The
// marker and inbox row commit together, so restart/concurrent polls cannot
// duplicate digests or count a failure twice. Model failures are never retried.
export async function completeAutomationRuns() {
  const runs = await db
    .select({
      id: schema.agentRunTable.id,
      trigger: schema.agentRunTable.trigger,
    })
    .from(schema.agentRunTable)
    .where(
      and(
        isNotNull(schema.agentRunTable.trigger),
        isNull(schema.agentRunTable.automationHandledAt),
        inArray(schema.agentRunTable.status, [
          "completed",
          "awaiting_review",
          "failed",
          "cancelled",
        ]),
      ),
    )
    .orderBy(schema.agentRunTable.finishedAt, schema.agentRunTable.id)
    .limit(100);
  for (const candidate of runs) {
    const notification = await db.transaction(async (tx) => {
      // All automation paths take this lock before locking its runs.
      const [automation] = await tx
        .select()
        .from(schema.agentAutomationTable)
        .where(
          eq(schema.agentAutomationTable.id, candidate.trigger!.automationId),
        )
        .for("update");
      const [run] = await tx
        .select()
        .from(schema.agentRunTable)
        .where(
          and(
            eq(schema.agentRunTable.id, candidate.id),
            isNull(schema.agentRunTable.automationHandledAt),
          ),
        )
        .for("update");
      if (!run) return null;
      await tx
        .update(schema.agentRunTable)
        .set({ automationHandledAt: new Date() })
        .where(eq(schema.agentRunTable.id, run.id));
      if (!automation) return null;
      const [conversation] = await tx
        .select()
        .from(schema.agentConversationTable)
        .where(eq(schema.agentConversationTable.id, run.conversationId));
      if (
        !conversation ||
        conversation.userId !== automation.ownerId ||
        run.status === "cancelled"
      )
        return null;
      const failed = run.status === "failed";
      const failures = failed ? automation.consecutiveFailures + 1 : 0;
      await tx
        .update(schema.agentAutomationTable)
        .set({ consecutiveFailures: failures })
        .where(eq(schema.agentAutomationTable.id, automation.id));
      if ((await checkOwnerAccess(automation)) === "lost")
        await pauseAutomation(tx, automation.id, "owner_access");
      else if (failures >= AUTOMATION_FAILURES_BEFORE_PAUSE)
        await pauseAutomation(tx, automation.id, "failures");
      if (!failed && run.trigger?.output !== "digest") return null;
      return persistNotification(
        {
          userId: automation.ownerId,
          resourceId: run.id,
          resourceType: "agent_run",
          type: failed ? "agent_automation_failed" : "agent_automation_digest",
          title: failed
            ? `Automation failed: ${automation.name}`
            : automation.name,
          content: failed
            ? failures >= AUTOMATION_FAILURES_BEFORE_PAUSE
              ? "Automation paused after three consecutive failures."
              : "The automation could not complete this run."
            : run.response,
          eventData: {
            workspaceId: automation.workspaceId,
            projectId: automation.projectId,
            automationId: automation.id,
            conversationId: run.conversationId,
            runId: run.id,
            url: `/dashboard/workspace/${automation.workspaceId}/agent?conversationId=${run.conversationId}&runId=${run.id}`,
          },
        },
        tx,
      );
    });
    // Inbox-only: no forwarding potentially private agent content to email or
    // third-party notification integrations.
    if (notification)
      await publishEvent("notification.created", {
        notificationId: notification.id,
        userId: notification.userId,
      });
  }
}
