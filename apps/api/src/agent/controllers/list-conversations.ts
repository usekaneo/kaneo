import { and, desc, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import type { AgentSubject } from "../types";

export async function listConversations(
  subject: AgentSubject,
  query: { limit: number; offset: number; projectId?: string },
) {
  return db
    .select()
    .from(schema.agentConversationTable)
    .where(
      and(
        eq(schema.agentConversationTable.userId, subject.userId),
        eq(schema.agentConversationTable.workspaceId, subject.workspaceId),
        query.projectId
          ? eq(schema.agentConversationTable.projectId, query.projectId)
          : undefined,
      ),
    )
    .orderBy(
      desc(schema.agentConversationTable.updatedAt),
      desc(schema.agentConversationTable.id),
    )
    .limit(query.limit)
    .offset(query.offset);
}
