import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import db, { schema } from "../../database";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { ownerColumns } from "../owner-columns";
import type { AgentSubject } from "../types";

function countProposals(status: "pending" | "applied") {
  return sql<number>`(select count(*)::int from ${schema.agentProposalTable} where ${schema.agentProposalTable.runId} = ${schema.agentRunTable.id} and ${schema.agentProposalTable.status} = ${status})`;
}

// Your runs plus runs in conversations shared with you, matching the read
// rule in access.ts: shared and, when project-scoped, a project you can read.
export async function listRecentRuns(
  subject: AgentSubject,
  paging: { limit: number; offset: number },
) {
  const conversation = schema.agentConversationTable;
  return db
    .select({
      id: schema.agentRunTable.id,
      conversationId: schema.agentRunTable.conversationId,
      projectId: conversation.projectId,
      prompt: schema.agentRunTable.prompt,
      status: schema.agentRunTable.status,
      pendingProposals: countProposals("pending"),
      appliedProposals: countProposals("applied"),
      shared: sql<boolean>`${conversation.sharedAt} is not null`,
      owner: ownerColumns,
      createdAt: schema.agentRunTable.createdAt,
      finishedAt: schema.agentRunTable.finishedAt,
    })
    .from(schema.agentRunTable)
    .innerJoin(
      conversation,
      eq(schema.agentRunTable.conversationId, conversation.id),
    )
    .innerJoin(schema.userTable, eq(conversation.userId, schema.userTable.id))
    .where(
      and(
        eq(conversation.workspaceId, subject.workspaceId),
        or(
          eq(conversation.userId, subject.userId),
          and(
            isNotNull(conversation.sharedAt),
            or(
              isNull(conversation.projectId),
              projectAccessCondition(subject.userId, conversation.projectId),
            ),
          ),
        ),
      ),
    )
    .orderBy(
      desc(schema.agentRunTable.createdAt),
      desc(schema.agentRunTable.id),
    )
    .limit(paging.limit)
    .offset(paging.offset);
}
