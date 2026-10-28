import { and, eq, isNull } from "drizzle-orm";
import { schema } from "../../database";
import type { AgentDatabase } from "../access";
import type { AutomationPauseReason, AutomationSkipReason } from "./types";

export async function pauseAutomation(
  database: AgentDatabase,
  automationId: string,
  reason: AutomationPauseReason,
) {
  await database
    .update(schema.agentAutomationTable)
    .set({ enabled: false, pausedReason: reason, nextRunAt: null })
    .where(eq(schema.agentAutomationTable.id, automationId));
  await database
    .update(schema.agentAutomationEventTable)
    .set({ consumedAt: new Date(), payload: null })
    .where(
      and(
        eq(schema.agentAutomationEventTable.automationId, automationId),
        isNull(schema.agentAutomationEventTable.consumedAt),
      ),
    );
}

export async function recordSkip(
  database: AgentDatabase,
  automationId: string,
  reason: AutomationSkipReason,
) {
  await database
    .update(schema.agentAutomationTable)
    .set({ lastSkipReason: reason, lastSkippedAt: new Date() })
    .where(eq(schema.agentAutomationTable.id, automationId));
}
