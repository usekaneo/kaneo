import type { ModelMessage } from "ai";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import db, { schema } from "../database";
import { withAttachmentNames } from "./attachment-messages";
import type { AgentAction } from "./types";

// Called after the runner has checked the conversation owner's current access.
export async function loadConversationHistory(conversationId: string) {
  const previous = await db
    .select({
      id: schema.agentRunTable.id,
      prompt: schema.agentRunTable.prompt,
      attachments: schema.agentRunTable.attachments,
      response: schema.agentRunTable.response,
      touchedProjectIds: schema.agentRunTable.touchedProjectIds,
    })
    .from(schema.agentRunTable)
    .where(
      and(
        eq(schema.agentRunTable.conversationId, conversationId),
        inArray(schema.agentRunTable.status, ["completed", "awaiting_review"]),
      ),
    )
    .orderBy(
      desc(schema.agentRunTable.createdAt),
      desc(schema.agentRunTable.id),
    )
    .limit(4);
  previous.reverse();
  const ids = previous.map((run) => run.id);
  const [steps, proposals] = ids.length
    ? await Promise.all([
        db
          .select({
            runId: schema.agentStepTable.runId,
            toolName: schema.agentStepTable.toolName,
            status: schema.agentStepTable.status,
          })
          .from(schema.agentStepTable)
          .where(inArray(schema.agentStepTable.runId, ids))
          .orderBy(schema.agentStepTable.createdAt, schema.agentStepTable.id),
        db
          .select({
            runId: schema.agentProposalTable.runId,
            type: sql<
              AgentAction["type"]
            >`${schema.agentProposalTable.action}->>'type'`,
            status: schema.agentProposalTable.status,
            taskId: sql<string | null>`case
              when ${schema.agentProposalTable.action}->>'type' = 'task.create'
                then ${schema.agentProposalTable.after}->>'id'
              else ${schema.agentProposalTable.action}->>'taskId'
            end`,
            jobId: sql<
              string | null
            >`${schema.agentProposalTable.after}->>'jobId'`,
          })
          .from(schema.agentProposalTable)
          .where(inArray(schema.agentProposalTable.runId, ids))
          .orderBy(
            schema.agentProposalTable.createdAt,
            schema.agentProposalTable.id,
          ),
      ])
    : [[], []];
  // Old tool outputs are not stored. Preserve execution evidence without
  // inventing a replay or resending workspace text and attachment contents.
  const records = previous.map((run, index) => ({
    turn: index + 1,
    tools: steps
      .filter((step) => step.runId === run.id)
      .map(({ toolName, status }) => ({ toolName, status })),
    proposals: proposals
      .filter((proposal) => proposal.runId === run.id)
      .map(({ type, status, taskId, jobId }) => ({
        type,
        status,
        taskId,
        ...(type === "code.run" ? { jobId } : {}),
      })),
  }));
  const messages: ModelMessage[] = previous.flatMap((run) => [
    {
      role: "user" as const,
      content: withAttachmentNames(run.prompt.slice(0, 3000), run.attachments),
    },
    { role: "assistant" as const, content: run.response.slice(0, 4000) },
  ]);
  return {
    messages,
    touchedProjectIds: previous.flatMap((run) => run.touchedProjectIds),
    executionRecords: records.length
      ? `<previous_run_execution>\n${JSON.stringify(records).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")}\n</previous_run_execution>`
      : "",
  };
}
