import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { schema } from "../../database";
import type { AgentDatabase } from "../access";
import { getEffectiveAgentConfig } from "../effective-config";
import { uniqueProjectIds } from "../touched-project-ids";
import { ensureAutomationConversation } from "./ensure-conversation";
import { parseMonthlyBudget, startOfUtcMonth } from "./limits";
import type { AgentRunTrigger, AutomationSkipReason } from "./types";

type Automation = typeof schema.agentAutomationTable.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function monthlyWorkspaceCost(
  database: AgentDatabase,
  workspaceId: string,
  now: Date,
) {
  const [row] = await database
    .select({
      total: sql<string>`coalesce(sum(${schema.agentRunTable.costUsd}::numeric), 0)::text`,
    })
    .from(schema.agentRunTable)
    .innerJoin(
      schema.agentConversationTable,
      eq(schema.agentRunTable.conversationId, schema.agentConversationTable.id),
    )
    .where(
      and(
        eq(schema.agentConversationTable.workspaceId, workspaceId),
        gte(schema.agentRunTable.createdAt, startOfUtcMonth(now)),
      ),
    );
  return Number(row?.total ?? 0);
}

async function runsInLastDay(
  database: AgentDatabase,
  automationId: string,
  now: Date,
) {
  const [row] = await database
    .select({ value: count() })
    .from(schema.agentRunTable)
    .innerJoin(
      schema.agentConversationTable,
      eq(schema.agentRunTable.conversationId, schema.agentConversationTable.id),
    )
    .where(
      and(
        eq(schema.agentConversationTable.automationId, automationId),
        gte(schema.agentRunTable.createdAt, new Date(now.getTime() - DAY_MS)),
      ),
    );
  return row?.value ?? 0;
}

export type QueueResult =
  | { queued: true; runId: string }
  | { queued: false; reason: AutomationSkipReason };

// Queues one run in the owner's automation conversation. The caller holds the
// automation row lock and has checked the owner's access. The request ID makes
// the insert idempotent for a schedule slot or event batch. Event projects
// cover the full batch, even when its displayed snapshots are truncated.
export async function queueAutomationRun(
  database: AgentDatabase,
  automation: Automation,
  trigger: Omit<AgentRunTrigger, "automationId" | "output">,
  requestId: string,
  now = new Date(),
  eventProjectIds: string[] = [],
): Promise<QueueResult> {
  // Match interactive runs' user-wide concurrency/rate limits across replicas.
  await database
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, automation.ownerId))
    .for("update");
  const conversation = await ensureAutomationConversation(database, automation);
  const [existing] = await database
    .select({ id: schema.agentRunTable.id })
    .from(schema.agentRunTable)
    .where(
      and(
        eq(schema.agentRunTable.conversationId, conversation.id),
        eq(schema.agentRunTable.requestId, requestId),
      ),
    );
  if (existing) return { queued: true, runId: existing.id };
  const ownedConversations = database
    .select({ id: schema.agentConversationTable.id })
    .from(schema.agentConversationTable)
    .where(eq(schema.agentConversationTable.userId, automation.ownerId));
  const [activeForUser] = await database
    .select({ value: count() })
    .from(schema.agentRunTable)
    .where(
      and(
        inArray(schema.agentRunTable.conversationId, ownedConversations),
        inArray(schema.agentRunTable.status, ["queued", "running"]),
      ),
    );
  const [recentForUser] = await database
    .select({ value: count() })
    .from(schema.agentRunTable)
    .where(
      and(
        inArray(schema.agentRunTable.conversationId, ownedConversations),
        gte(schema.agentRunTable.createdAt, new Date(now.getTime() - 60000)),
      ),
    );
  if ((activeForUser?.value ?? 0) >= 2 || (recentForUser?.value ?? 0) >= 10)
    return { queued: false, reason: "overlap" };
  const config = await getEffectiveAgentConfig();
  if (!config) return { queued: false, reason: "unavailable" };
  if (
    (await runsInLastDay(database, automation.id, now)) >=
    automation.dailyRunLimit
  )
    return { queued: false, reason: "daily_limit" };
  // Covers every agent run in the workspace, but only automation runs are
  // held back; people can still use the assistant directly.
  const budget = parseMonthlyBudget(
    process.env.KANEO_AGENT_WORKSPACE_MONTHLY_USD,
  );
  if (
    budget !== null &&
    (await monthlyWorkspaceCost(database, automation.workspaceId, now)) >=
      budget
  )
    return { queued: false, reason: "budget" };
  const [active] = await database
    .select({ id: schema.agentRunTable.id })
    .from(schema.agentRunTable)
    .where(
      and(
        eq(schema.agentRunTable.conversationId, conversation.id),
        inArray(schema.agentRunTable.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (active) return { queued: false, reason: "overlap" };
  // Configuration changes must not silently switch an owner's chosen model.
  if (!config.models.includes(automation.model))
    return { queued: false, reason: "unavailable" };
  const model = automation.model;
  const [run] = await database
    .insert(schema.agentRunTable)
    .values({
      conversationId: conversation.id,
      requestId,
      prompt: automation.prompt,
      model,
      touchedProjectIds: uniqueProjectIds([
        automation.projectId,
        ...eventProjectIds,
        ...trigger.events.map((event) => event.projectId),
      ]),
      trigger: {
        ...trigger,
        automationId: automation.id,
        output: automation.output,
      },
    })
    .onConflictDoNothing()
    .returning({ id: schema.agentRunTable.id });
  if (!run) {
    const [existing] = await database
      .select({ id: schema.agentRunTable.id })
      .from(schema.agentRunTable)
      .where(
        and(
          eq(schema.agentRunTable.conversationId, conversation.id),
          eq(schema.agentRunTable.requestId, requestId),
        ),
      );
    return existing
      ? { queued: true, runId: existing.id }
      : { queued: false, reason: "overlap" };
  }
  await database
    .update(schema.agentConversationTable)
    .set({ updatedAt: now })
    .where(eq(schema.agentConversationTable.id, conversation.id));
  return { queued: true, runId: run.id };
}
