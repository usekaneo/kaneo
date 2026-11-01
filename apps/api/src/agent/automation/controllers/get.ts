import { and, eq, gte, sql } from "drizzle-orm";
import db, { schema } from "../../../database";
import { touchedProjectsReadable } from "../../run-visibility";
import type { AgentSubject } from "../../types";
import { getVisibleAutomation } from "../access";
import { startOfUtcMonth } from "../limits";

export async function getAutomation(subject: AgentSubject, id: string) {
  const {
    automation: row,
    conversation,
    isOwner,
    admin,
    canRead,
  } = await getVisibleAutomation(subject, id);
  const [owner] = await db
    .select({
      id: schema.userTable.id,
      name: schema.userTable.name,
      image: schema.userTable.image,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, row.ownerId));
  const [project] = row.projectId
    ? await db
        .select({ id: schema.projectTable.id, name: schema.projectTable.name })
        .from(schema.projectTable)
        .where(eq(schema.projectTable.id, row.projectId))
    : [];
  const [cost] =
    canRead && conversation
      ? await db
          .select({
            total: sql<string>`coalesce(sum(${schema.agentRunTable.costUsd}::numeric), 0)::text`,
          })
          .from(schema.agentRunTable)
          .where(
            and(
              eq(schema.agentRunTable.conversationId, conversation.id),
              gte(schema.agentRunTable.createdAt, startOfUtcMonth(new Date())),
              isOwner ? undefined : touchedProjectsReadable(subject),
            ),
          )
      : [];
  const {
    eventType: _eventType,
    eventCursorAt: _cursor,
    ownerId: _ownerId,
    ...publicRow
  } = row;
  return {
    ...publicRow,
    prompt: canRead ? row.prompt : null,
    owner: owner!,
    project: project ?? null,
    conversationId: canRead ? (conversation?.id ?? null) : null,
    sharedAt: canRead ? (conversation?.sharedAt ?? null) : null,
    monthCostUsd: cost?.total ?? "0",
    viewer: { isOwner, canTakeOver: admin && !isOwner },
  };
}
