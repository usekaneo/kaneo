import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { publishEvent } from "../../events";
import { requireWorkspaceEntitlement } from "../../billing/controllers/require-entitlement";
import { recordTaskMutation } from "../../task/controllers/task-mutation-effects";
import { assertAssignableUser } from "../../utils/assert-assignable-user";
import { validateDateRange } from "../../utils/validate-dates";
import { assertAgentAccess, getOwnedRun } from "../access";
import { matchesSnapshot, taskSnapshot } from "../snapshot";
import { actionPermissions } from "../action-permissions";
import { getScopedTask } from "./get-scoped-task";
import { undoComment } from "./undo-comment";
import type { AgentSubject } from "../types";

export async function undoProposal(subject: AgentSubject, proposalId: string) {
  const [row] = await db
    .select({ runId: schema.agentProposalTable.runId })
    .from(schema.agentProposalTable)
    .where(eq(schema.agentProposalTable.id, proposalId));
  if (!row) throw new HTTPException(404, { message: "Proposal not found" });
  const { run } = await getOwnedRun(subject, row.runId);
  await requireWorkspaceEntitlement(subject.workspaceId);
  const result = await db.transaction(async (tx) => {
    const { subject: scoped } = await getOwnedRun(subject, row.runId, tx);
    await tx
      .select({ id: schema.agentRunTable.id })
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, row.runId))
      .for("update");
    const [proposal] = await tx
      .select()
      .from(schema.agentProposalTable)
      .where(eq(schema.agentProposalTable.id, proposalId))
      .for("update");
    if (!proposal)
      throw new HTTPException(404, { message: "Proposal not found" });
    await assertAgentAccess(scoped, actionPermissions(proposal.action), tx);
    if (proposal.status === "undone")
      return { id: proposalId, status: "undone" as const };
    if (proposal.status !== "applied")
      throw new HTTPException(409, {
        message: "Only applied changes can be undone",
      });
    if (proposal.action.type === "code.run")
      throw new HTTPException(400, {
        message:
          "Cancel the coding job or close its pull request through the normal workflow",
      });
    if (proposal.action.type === "task.create")
      throw new HTTPException(400, {
        message:
          "Created tasks must be deleted through the normal task workflow",
      });
    if (!proposal.before || !proposal.after)
      throw new HTTPException(409, {
        message: "Proposal has no task snapshot",
      });
    await tx
      .select({ id: schema.projectTable.id })
      .from(schema.projectTable)
      .where(
        and(
          eq(schema.projectTable.id, proposal.before.projectId),
          eq(schema.projectTable.workspaceId, scoped.workspaceId),
        ),
      )
      .for("update");
    if (proposal.action.type === "comment.create") {
      await undoComment(
        tx,
        scoped,
        proposalId,
        proposal.action,
        proposal.after,
      );
      await tx
        .update(schema.agentProposalTable)
        .set({ status: "undone", undoneAt: new Date() })
        .where(eq(schema.agentProposalTable.id, proposalId));
      return { id: proposalId, status: "undone" as const };
    }
    await tx
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, proposal.action.taskId))
      .for("update");
    const task = await getScopedTask(scoped, proposal.action.taskId, tx);
    const fields = Object.keys(proposal.action.patch);
    if (!matchesSnapshot(taskSnapshot(task), proposal.after, fields))
      throw new HTTPException(409, {
        message: "Task changed after the agent update; cannot safely undo",
      });
    const changes: {
      title?: string;
      priority?: string;
      userId?: string | null;
      dueDate?: Date | null;
    } = {};
    if (fields.includes("title")) changes.title = proposal.before.title;
    if (fields.includes("priority"))
      changes.priority = proposal.before.priority;
    if (fields.includes("userId")) {
      if (proposal.before.userId)
        await assertAssignableUser(
          proposal.before.userId,
          scoped.workspaceId,
          task.projectId,
          tx,
        );
      changes.userId = proposal.before.userId;
    }
    if (fields.includes("dueDate")) {
      changes.dueDate = proposal.before.dueDate
        ? new Date(proposal.before.dueDate)
        : null;
      validateDateRange(task.startDate, changes.dueDate);
    }
    const [restored] = await tx
      .update(schema.taskTable)
      .set(changes)
      .where(eq(schema.taskTable.id, task.id))
      .returning();
    if (!restored) throw new HTTPException(404, { message: "Task not found" });
    await recordTaskMutation(tx, task, changes, scoped.userId);
    await tx.insert(schema.agentEffectTable).values({
      proposalId,
      userId: scoped.userId,
      payload: {
        kind: "task.update",
        before: taskSnapshot(task),
        after: taskSnapshot(restored),
      },
    });
    await tx
      .update(schema.agentProposalTable)
      .set({ status: "undone", undoneAt: new Date() })
      .where(eq(schema.agentProposalTable.id, proposalId));
    return { id: proposalId, status: "undone" as const };
  });
  await publishEvent("agent.run_updated", {
    userId: subject.userId,
    workspaceId: subject.workspaceId,
    runId: row.runId,
    conversationId: run.conversationId,
  });
  return result;
}
