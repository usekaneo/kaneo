import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import db, { schema } from "../../../database";
import { projectAccessCondition } from "../../../project-access/project-access-condition";
import type { AgentSubject } from "../../types";
import {
  isAutomationAdmin,
  ownerConversationJoin,
  readableAutomationScope,
  sharedWith,
  visibleAutomations,
} from "../access";
import { listAutomationsQuery } from "../schema";

export async function listAutomations(
  subject: AgentSubject,
  query: z.infer<typeof listAutomationsQuery>,
) {
  const admin = await isAutomationAdmin(subject);
  const a = schema.agentAutomationTable,
    c = schema.agentConversationTable,
    p = schema.projectTable,
    r = schema.workflowRuleTable;
  const condition = and(
    visibleAutomations(subject, admin),
    query.projectId ? eq(a.projectId, query.projectId) : undefined,
    query.ownerId ? eq(a.ownerId, query.ownerId) : undefined,
  );
  const rulesCondition = and(
    eq(p.workspaceId, subject.workspaceId),
    projectAccessCondition(subject.userId, p.id),
    query.projectId ? eq(p.id, query.projectId) : undefined,
    query.ownerId ? sql`false` : undefined,
  );
  const [[agentsCount], [rulesCount]] = await Promise.all([
    db
      .select({ value: count() })
      .from(a)
      .leftJoin(c, ownerConversationJoin)
      .where(condition),
    db
      .select({ value: count() })
      .from(r)
      .innerJoin(p, eq(r.projectId, p.id))
      .where(rulesCondition),
  ]);
  const take = query.offset + query.limit;
  const [agents, rules] = await Promise.all([
    query.kind === "rules"
      ? []
      : db
          .select({
            kind: sql<"agent">`'agent'`,
            id: a.id,
            name: a.name,
            trigger: a.trigger,
            output: a.output,
            model: a.model,
            enabled: a.enabled,
            pausedReason: a.pausedReason,
            lastSkipReason: a.lastSkipReason,
            lastSkippedAt: a.lastSkippedAt,
            nextRunAt: a.nextRunAt,
            createdAt: a.createdAt,
            owner: {
              id: schema.userTable.id,
              name: schema.userTable.name,
              image: schema.userTable.image,
            },
            project: { id: p.id, name: p.name },
            lastRun: sql<{
              id: string;
              status: typeof schema.agentRunTable.$inferSelect.status;
              pendingProposals: number;
              createdAt: string;
            } | null>`CASE WHEN ((${eq(a.ownerId, subject.userId)} AND ${readableAutomationScope(subject)}) OR ${sharedWith(subject)}) THEN (
        SELECT json_build_object('id', ar.id, 'status', ar.status, 'createdAt', ar.created_at,
          'pendingProposals', (SELECT count(*)::int FROM agent_proposal ap WHERE ap.run_id = ar.id AND ap.status = 'pending'))
        FROM agent_run ar WHERE ar.conversation_id = ${c.id} ORDER BY ar.created_at DESC, ar.id DESC LIMIT 1
      ) ELSE NULL END`,
          })
          .from(a)
          .leftJoin(c, ownerConversationJoin)
          .innerJoin(schema.userTable, eq(a.ownerId, schema.userTable.id))
          .leftJoin(p, eq(a.projectId, p.id))
          .where(condition)
          .orderBy(desc(a.createdAt), desc(a.id))
          .limit(take),
    query.kind === "agent"
      ? []
      : db
          .select({
            kind: sql<"rule">`'rule'`,
            id: r.id,
            project: { id: p.id, name: p.name },
            integrationType: r.integrationType,
            eventType: r.eventType,
            columnName: schema.columnTable.name,
            createdAt: r.createdAt,
          })
          .from(r)
          .innerJoin(p, eq(r.projectId, p.id))
          .leftJoin(schema.columnTable, eq(r.columnId, schema.columnTable.id))
          .where(rulesCondition)
          .orderBy(desc(r.createdAt), desc(r.id))
          .limit(take),
  ]);
  const counts = {
    agent: agentsCount?.value ?? 0,
    rules: rulesCount?.value ?? 0,
    all: (agentsCount?.value ?? 0) + (rulesCount?.value ?? 0),
  };
  return {
    items: [...agents, ...rules]
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      )
      .slice(query.offset, take),
    total: counts[query.kind],
    counts,
  };
}
