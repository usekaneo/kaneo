import { jobsForRuns } from "../code/read-jobs";
import { desc, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { getVisibleConversation } from "../access";
import { summarizeAttachments } from "../attachment-summary";
import type { AgentSubject } from "../types";

export async function listRuns(
  subject: AgentSubject,
  conversationId: string,
  paging: { limit: number; offset: number },
) {
  await getVisibleConversation(subject, conversationId);
  const runs = await db
    .select({
      id: schema.agentRunTable.id,
      conversationId: schema.agentRunTable.conversationId,
      requestId: schema.agentRunTable.requestId,
      prompt: schema.agentRunTable.prompt,
      attachments: schema.agentRunTable.attachments,
      response: schema.agentRunTable.response,
      status: schema.agentRunTable.status,
      model: schema.agentRunTable.model,
      error: schema.agentRunTable.error,
      inputTokens: schema.agentRunTable.inputTokens,
      outputTokens: schema.agentRunTable.outputTokens,
      costUsd: schema.agentRunTable.costUsd,
      createdAt: schema.agentRunTable.createdAt,
      finishedAt: schema.agentRunTable.finishedAt,
    })
    .from(schema.agentRunTable)
    .where(eq(schema.agentRunTable.conversationId, conversationId))
    .orderBy(
      desc(schema.agentRunTable.createdAt),
      desc(schema.agentRunTable.id),
    )
    .limit(paging.limit)
    .offset(paging.offset);
  const jobs = await jobsForRuns(
    runs.map((run) => run.id),
    subject,
  );
  return runs.map((run) => ({
    ...run,
    jobs: jobs.filter((job) => job.runId === run.id),
    attachments: summarizeAttachments(run.attachments),
  }));
}
