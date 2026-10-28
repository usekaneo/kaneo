import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../../database";
import type { AgentSubject } from "../../types";
import { getOwnedAutomation } from "../access";
import { checkOwnerAccess } from "../owner-access";
import { nextScheduledRun } from "../schedule";

export async function setAutomationEnabled(
  subject: AgentSubject,
  id: string,
  enabled: boolean,
) {
  await getOwnedAutomation(subject, id);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.agentAutomationTable)
      .where(eq(schema.agentAutomationTable.id, id))
      .for("update");
    if (!row || row.ownerId !== subject.userId)
      throw new HTTPException(409, { message: "Automation owner changed" });
    if (enabled && (await checkOwnerAccess(row)) !== "ok")
      throw new HTTPException(403, {
        message: "Automation owner has lost access",
      });
    if (row.enabled === enabled && !row.pausedReason) return;
    const now = new Date();
    await tx
      .update(schema.agentAutomationTable)
      .set({
        enabled,
        pausedReason: null,
        consecutiveFailures: 0,
        lastSkipReason: null,
        lastSkippedAt: null,
        nextRunAt:
          enabled && row.trigger.type === "schedule"
            ? nextScheduledRun(row.trigger, now)
            : null,
        eventCursorAt: now,
      })
      .where(eq(schema.agentAutomationTable.id, id));
    // Disable also cancels the waiting event batch, not an in-flight model call.
    await tx
      .update(schema.agentAutomationEventTable)
      .set({ consumedAt: new Date(), payload: null })
      .where(
        and(
          eq(schema.agentAutomationEventTable.automationId, id),
          isNull(schema.agentAutomationEventTable.consumedAt),
        ),
      );
  });
}
