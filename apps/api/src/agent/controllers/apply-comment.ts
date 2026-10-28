import { eq } from "drizzle-orm";
import { schema } from "../../database";
import { recordComment } from "../../activity/controllers/create-comment";
import type { AgentDatabase } from "../access";
import { toAgentComment } from "../comment-record";
import { taskSnapshot } from "../snapshot";
import type { AgentAction, AgentEffect, AgentSubject } from "../types";
import { getScopedTask } from "./get-scoped-task";

// Posts the comment as the applying user through the normal comment domain.
// Events and notifications go out through the returned effect after commit.
export async function applyComment(
  tx: AgentDatabase,
  subject: AgentSubject,
  proposalId: string,
  action: Extract<AgentAction, { type: "comment.create" }>,
): Promise<AgentEffect> {
  // Keeps the task from being deleted between the scope check and the insert.
  await tx
    .select({ id: schema.taskTable.id })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, action.taskId))
    .for("share");
  const task = await getScopedTask(subject, action.taskId, tx);
  const recorded = await recordComment(
    tx,
    task.id,
    subject.userId,
    action.body,
  );
  const before = taskSnapshot(task);
  await tx
    .update(schema.agentProposalTable)
    .set({
      before,
      after: { ...before, commentId: recorded.activity.id },
      status: "applied",
      appliedAt: new Date(),
    })
    .where(eq(schema.agentProposalTable.id, proposalId));
  return {
    kind: "comment.create",
    comment: toAgentComment(recorded.activity),
    projectId: recorded.projectId,
    summary: recorded.summary,
    notifications: recorded.notifications,
  };
}
