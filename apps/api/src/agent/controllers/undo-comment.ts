import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "../../database";
import { removeComment } from "../../activity/controllers/delete-comment";
import type { AgentDatabase } from "../access";
import { toAgentComment } from "../comment-record";
import type { AgentAction, AgentSnapshot, AgentSubject } from "../types";
import { getScopedTask } from "./get-scoped-task";

// Deletes the posted comment only while it is exactly as the agent wrote it.
export async function undoComment(
  tx: AgentDatabase,
  subject: AgentSubject,
  proposalId: string,
  action: Extract<AgentAction, { type: "comment.create" }>,
  after: AgentSnapshot,
) {
  if (!after.commentId)
    throw new HTTPException(409, { message: "Proposal has no comment" });
  await tx
    .select({ id: schema.taskTable.id })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, action.taskId))
    .for("share");
  await getScopedTask(subject, action.taskId, tx);
  const [comment] = await tx
    .select()
    .from(schema.activityTable)
    .where(
      and(
        eq(schema.activityTable.id, after.commentId),
        eq(schema.activityTable.type, "comment"),
      ),
    )
    .for("update");
  if (
    !comment ||
    comment.taskId !== action.taskId ||
    comment.userId !== subject.userId ||
    comment.content !== action.body ||
    comment.updatedAt.getTime() !== comment.createdAt.getTime()
  )
    throw new HTTPException(409, {
      message: "Comment changed after the agent posted it; cannot safely undo",
    });
  const removed = await removeComment(tx, subject.userId, comment.id);
  await tx.insert(schema.agentEffectTable).values({
    proposalId,
    userId: subject.userId,
    payload: {
      kind: "comment.delete",
      comment: toAgentComment(removed.comment),
      projectId: removed.projectId,
    },
  });
}
