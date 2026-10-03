import { and, desc, eq, sql } from "drizzle-orm";
import db, { schema } from "../../database";
import type { AgentSubject } from "../types";

function countProposals(status: "pending" | "applied") {
  return sql<number>`(select count(*)::int from ${schema.agentProposalTable} where ${schema.agentProposalTable.runId} = ${schema.agentRunTable.id} and ${schema.agentProposalTable.status} = ${status})`;
}

export async function listRecentRuns(
  subject: AgentSubject,
  paging: { limit: number; offset: number },
) {
  return db
    .select({
      id: schema.agentRunTable.id,
      conversationId: schema.agentRunTable.conversationId,
      projectId: schema.agentConversationTable.projectId,
      prompt: schema.agentRunTable.prompt,
      status: schema.agentRunTable.status,
      pendingProposals: countProposals("pending"),
      appliedProposals: countProposals("applied"),
      createdAt: schema.agentRunTable.createdAt,
      finishedAt: schema.agentRunTable.finishedAt,
    })
    .from(schema.agentRunTable)
    .innerJoin(
      schema.agentConversationTable,
      eq(schema.agentRunTable.conversationId, schema.agentConversationTable.id),
    )
    .where(
      and(
        eq(schema.agentConversationTable.userId, subject.userId),
        eq(schema.agentConversationTable.workspaceId, subject.workspaceId),
      ),
    )
    .orderBy(
      desc(schema.agentRunTable.createdAt),
      desc(schema.agentRunTable.id),
    )
    .limit(paging.limit)
    .offset(paging.offset);
}
