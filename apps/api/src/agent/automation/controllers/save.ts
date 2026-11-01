import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import db, { schema } from "../../../database";
import { assertAgentAccess, assertAgentProject } from "../../access";
import { requireEffectiveAgentConfig } from "../../effective-config";
import type { AgentSubject } from "../../types";
import { getOwnedAutomation } from "../access";
import { ensureAutomationConversation } from "../ensure-conversation";
import { AUTOMATION_LIMIT_PER_OWNER } from "../limits";
import { nextScheduledRun } from "../schedule";
import { createAutomationSchema } from "../schema";

export async function saveAutomation(
  subject: AgentSubject,
  input: z.infer<typeof createAutomationSchema>,
  id?: string,
) {
  const config = await requireEffectiveAgentConfig();
  await assertAgentAccess(subject);
  if (input.projectId) await assertAgentProject(subject, input.projectId);
  if (input.trigger.type === "event" && input.trigger.filters.projectId)
    await assertAgentProject(subject, input.trigger.filters.projectId);
  const model = input.model ?? config.model;
  if (!config.models.includes(model))
    throw new HTTPException(400, {
      message: "Model is not available on this instance",
    });
  if (id) await getOwnedAutomation(subject, id);
  return db.transaction(async (tx) => {
    // Serialize owner limits and edits against run queueing/takeover.
    const [existing] = id
      ? await tx
          .select()
          .from(schema.agentAutomationTable)
          .where(eq(schema.agentAutomationTable.id, id))
          .for("update")
      : [];
    await tx
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, subject.userId))
      .for("update");
    if (id && (!existing || existing.ownerId !== subject.userId))
      throw new HTTPException(409, { message: "Automation owner changed" });
    if (!id) {
      const [total] = await tx
        .select({ value: count() })
        .from(schema.agentAutomationTable)
        .where(
          and(
            eq(schema.agentAutomationTable.ownerId, subject.userId),
            eq(schema.agentAutomationTable.workspaceId, subject.workspaceId),
          ),
        );
      if ((total?.value ?? 0) >= AUTOMATION_LIMIT_PER_OWNER)
        throw new HTTPException(429, { message: "Automation limit reached" });
    }
    const now = new Date();
    const values = {
      ...input,
      model,
      ownerId: subject.userId,
      workspaceId: subject.workspaceId,
      eventType: input.trigger.type === "event" ? input.trigger.event : null,
      nextRunAt:
        input.enabled && input.trigger.type === "schedule"
          ? nextScheduledRun(input.trigger, now)
          : null,
      eventCursorAt: now,
      pausedReason: null,
      consecutiveFailures: 0,
      lastSkipReason: null,
      lastSkippedAt: null,
    };
    const [automation] = existing
      ? await tx
          .update(schema.agentAutomationTable)
          .set(values)
          .where(eq(schema.agentAutomationTable.id, existing.id))
          .returning()
      : await tx.insert(schema.agentAutomationTable).values(values).returning();
    if (!automation)
      throw new HTTPException(500, { message: "Could not save automation" });
    if (existing)
      await tx
        .update(schema.agentAutomationEventTable)
        .set({ consumedAt: now, payload: null })
        .where(
          and(
            eq(schema.agentAutomationEventTable.automationId, automation.id),
            isNull(schema.agentAutomationEventTable.consumedAt),
          ),
        );
    if (existing && existing.projectId !== automation.projectId) {
      // A different scope gets its own private thread; never relabel old tool
      // results as belonging to another project's access boundary.
      const conversations = tx
        .select({ id: schema.agentConversationTable.id })
        .from(schema.agentConversationTable)
        .where(eq(schema.agentConversationTable.automationId, automation.id));
      await tx
        .update(schema.agentConversationTable)
        .set({ sharedAt: null })
        .where(eq(schema.agentConversationTable.automationId, automation.id));
      await tx
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
        );
    }
    await ensureAutomationConversation(tx, automation);
    return automation.id;
  });
}
