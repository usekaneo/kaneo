import { and, desc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../../database";
import { touchedProjectsReadable } from "../../run-visibility";
import type { AgentSubject } from "../../types";
import { getVisibleAutomation } from "../access";

export async function listAutomationRuns(
  subject: AgentSubject,
  id: string,
  paging: { limit: number; offset: number },
) {
  const { canRead, conversation } = await getVisibleAutomation(subject, id);
  if (!canRead || !conversation)
    throw new HTTPException(404, { message: "Automation history not found" });
  const r = schema.agentRunTable;
  return db
    .select({
      id: r.id,
      conversationId: r.conversationId,
      status: r.status,
      error: r.error,
      model: r.model,
      costUsd: r.costUsd,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      trigger: r.trigger,
      createdAt: r.createdAt,
      finishedAt: r.finishedAt,
      pendingProposals: sql<number>`(SELECT count(*)::int FROM agent_proposal p WHERE p.run_id = ${r.id} AND p.status = 'pending')`,
      appliedProposals: sql<number>`(SELECT count(*)::int FROM agent_proposal p WHERE p.run_id = ${r.id} AND p.status = 'applied')`,
      owner: {
        id: schema.userTable.id,
        name: schema.userTable.name,
        image: schema.userTable.image,
      },
    })
    .from(r)
    .innerJoin(
      schema.agentConversationTable,
      eq(r.conversationId, schema.agentConversationTable.id),
    )
    .innerJoin(
      schema.userTable,
      eq(schema.agentConversationTable.userId, schema.userTable.id),
    )
    .where(
      and(
        eq(r.conversationId, conversation.id),
        conversation.userId === subject.userId
          ? undefined
          : touchedProjectsReadable(subject),
      ),
    )
    .orderBy(desc(r.createdAt), desc(r.id))
    .limit(paging.limit)
    .offset(paging.offset);
}
