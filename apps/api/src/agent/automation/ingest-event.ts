import { and, count, eq, isNull, or } from "drizzle-orm";
import db, { schema } from "../../database";
import { HTTPException } from "hono/http-exception";
import { assertAgentProject } from "../access";
import type { AgentDatabase } from "../access";
import { matchesAutomationFilters } from "./event-filter";
import { AUTOMATION_PENDING_EVENT_LIMIT } from "./limits";
import type { AutomationEventName, AutomationEventRef } from "./types";

type Automation = typeof schema.agentAutomationTable.$inferSelect;
export type AutomationDomainEvent = {
  id?: string;
  updatedAt?: Date | string;
  taskId: string;
  projectId: string;
  fromProjectId?: string;
  toProjectId?: string;
  userId?: string | null;
  oldStatus?: string;
  newStatus?: string;
  commentId?: string;
  comment?: string;
  eventId?: string;
  pullRequest?: AutomationEventRef["pullRequest"];
};

export async function appendAutomationEvent(
  database: AgentDatabase,
  automation: Automation,
  event: AutomationEventName,
  data: AutomationDomainEvent,
  dedupeKey: string,
  now: Date,
) {
  if (automation.trigger.type !== "event" || automation.trigger.event !== event)
    return;
  try {
    await assertAgentProject(
      {
        userId: automation.ownerId,
        workspaceId: automation.workspaceId,
        projectId: automation.projectId,
      },
      data.projectId,
      database,
    );
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404) return;
    throw error;
  }
  const [task] = await database
    .select({
      id: schema.taskTable.id,
      projectId: schema.taskTable.projectId,
      columnName: schema.columnTable.name,
    })
    .from(schema.taskTable)
    .leftJoin(
      schema.columnTable,
      eq(schema.taskTable.columnId, schema.columnTable.id),
    )
    .where(
      and(
        eq(schema.taskTable.id, data.taskId),
        eq(schema.taskTable.projectId, data.projectId),
      ),
    )
    .limit(1);
  if (!task) return;
  if (event === "task_moved" && data.newStatus) {
    const [column] = await database
      .select({ name: schema.columnTable.name })
      .from(schema.columnTable)
      .where(
        and(
          eq(schema.columnTable.projectId, data.projectId),
          eq(schema.columnTable.slug, data.newStatus),
        ),
      )
      .limit(1);
    task.columnName = column?.name ?? null;
  }
  const labels = await database
    .select({ name: schema.labelTable.name })
    .from(schema.labelTable)
    .where(eq(schema.labelTable.taskId, task.id));
  if (
    !matchesAutomationFilters(
      {
        ...automation.trigger.filters,
        projectId: automation.projectId ?? automation.trigger.filters.projectId,
      },
      { ...task, labelNames: labels.map((label) => label.name) },
    )
  )
    return;
  const [pending] = await database
    .select({ value: count() })
    .from(schema.agentAutomationEventTable)
    .where(
      and(
        eq(schema.agentAutomationEventTable.automationId, automation.id),
        isNull(schema.agentAutomationEventTable.consumedAt),
      ),
    );
  if ((pending?.value ?? 0) >= AUTOMATION_PENDING_EVENT_LIMIT) return;
  const [actor] = data.userId
    ? await database
        .select({ name: schema.userTable.name })
        .from(schema.userTable)
        .where(eq(schema.userTable.id, data.userId))
        .limit(1)
    : [];
  const payload: AutomationEventRef = {
    event,
    taskId: task.id,
    projectId: task.projectId,
    occurredAt: now.toISOString(),
    actorName: actor?.name.slice(0, 100) ?? null,
    columnName: task.columnName,
    pullRequest: data.pullRequest
      ? {
          number: data.pullRequest.number,
          title: data.pullRequest.title.slice(0, 300),
          url: data.pullRequest.url.slice(0, 2000),
        }
      : null,
    commentPreview: data.comment?.slice(0, 300) ?? null,
  };
  await database
    .insert(schema.agentAutomationEventTable)
    .values({ automationId: automation.id, dedupeKey, payload, createdAt: now })
    .onConflictDoNothing();
}

export async function ingestAutomationEvent(
  event: AutomationEventName,
  data: AutomationDomainEvent,
  dedupeKey: string,
  now = new Date(),
) {
  if (
    event === "task_moved" &&
    data.oldStatus === data.newStatus &&
    data.fromProjectId === data.toProjectId
  )
    return;
  const [project] = await db
    .select({ workspaceId: schema.projectTable.workspaceId })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, data.projectId));
  if (!project) return;
  const candidates = await db
    .select({ id: schema.agentAutomationTable.id })
    .from(schema.agentAutomationTable)
    .where(
      and(
        eq(schema.agentAutomationTable.workspaceId, project.workspaceId),
        eq(schema.agentAutomationTable.enabled, true),
        eq(schema.agentAutomationTable.eventType, event),
        or(
          isNull(schema.agentAutomationTable.projectId),
          eq(schema.agentAutomationTable.projectId, data.projectId),
        ),
      ),
    );
  for (const candidate of candidates)
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.agentAutomationTable)
        .where(eq(schema.agentAutomationTable.id, candidate.id))
        .for("update");
      if (row?.enabled)
        await appendAutomationEvent(tx, row, event, data, dedupeKey, now);
    });
}
