import { insertCodeJob } from "../code/create-job";
import { notifyJob } from "../code/notify";
import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { requireWorkspaceEntitlement } from "../../billing/controllers/require-entitlement";
import createTask from "../../task/controllers/create-task";
import { recordTaskMutation } from "../../task/controllers/task-mutation-effects";
import { validateDateRange } from "../../utils/validate-dates";
import { assertAgentAccess, getOwnedRun } from "../access";
import { agentActionSchema } from "../schema";
import { matchesSnapshot, taskSnapshot } from "../snapshot";
import { actionPermissions } from "../action-permissions";
import { applyComment } from "./apply-comment";
import { getScopedTask } from "./get-scoped-task";
import { validateAction } from "../validate-action";
import type { AgentEffect, AgentSubject } from "../types";

export async function applyProposals(
  subject: AgentSubject,
  runId: string,
  proposalIds: string[],
) {
  await getOwnedRun(subject, runId);
  await requireWorkspaceEntitlement(subject.workspaceId);
  const found = await db
    .select({ id: schema.agentProposalTable.id })
    .from(schema.agentProposalTable)
    .where(
      and(
        eq(schema.agentProposalTable.runId, runId),
        inArray(schema.agentProposalTable.id, proposalIds),
      ),
    );
  if (found.length !== proposalIds.length)
    throw new HTTPException(404, { message: "Proposal not found" });
  const results: Array<{
    id: string;
    status: "applied" | "failed";
    error: string | null;
    code: number | null;
  }> = [];
  for (const proposalId of proposalIds) {
    try {
      await db.transaction(async (tx) => {
        const { subject: scoped } = await getOwnedRun(subject, runId, tx);
        const [run] = await tx
          .select()
          .from(schema.agentRunTable)
          .where(eq(schema.agentRunTable.id, runId))
          .for("update");
        if (!run || !["awaiting_review", "completed"].includes(run.status))
          throw new HTTPException(409, {
            message: "Run is not ready for review",
          });
        const [proposal] = await tx
          .select()
          .from(schema.agentProposalTable)
          .where(eq(schema.agentProposalTable.id, proposalId))
          .for("update");
        if (!proposal)
          throw new HTTPException(404, { message: "Proposal not found" });
        const action = agentActionSchema.parse(proposal.action);
        if (run.trigger?.output === "digest")
          throw new HTTPException(403, {
            message: "Digest runs are read-only",
          });
        if (run.trigger && action.type === "code.run")
          throw new HTTPException(403, {
            message: "Automations cannot start coding jobs",
          });
        await assertAgentAccess(scoped, actionPermissions(action), tx);
        if (proposal.status === "applied") return;
        if (proposal.status !== "pending")
          throw new HTTPException(409, {
            message: "Proposal is no longer pending",
          });
        await validateAction(scoped, action, tx);
        const projectId =
          action.type === "task.create"
            ? action.projectId
            : proposal.before?.projectId;
        if (!projectId)
          throw new HTTPException(409, {
            message: "Proposal has no task snapshot",
          });
        // Match project-move lock order: project first, task second.
        const [project] = await tx
          .select()
          .from(schema.projectTable)
          .where(
            and(
              eq(schema.projectTable.id, projectId),
              eq(schema.projectTable.workspaceId, scoped.workspaceId),
            ),
          )
          .for("update");
        if (!project)
          throw new HTTPException(404, { message: "Project not found" });
        if (action.type === "code.run") {
          await insertCodeJob(
            tx,
            scoped,
            runId,
            proposalId,
            proposalId,
            action,
          );
          const [pending] = await tx
            .select({ id: schema.agentProposalTable.id })
            .from(schema.agentProposalTable)
            .where(
              and(
                eq(schema.agentProposalTable.runId, runId),
                eq(schema.agentProposalTable.status, "pending"),
              ),
            )
            .limit(1);
          if (!pending)
            await tx
              .update(schema.agentRunTable)
              .set({ status: "completed" })
              .where(eq(schema.agentRunTable.id, runId));
          return;
        }
        let effect: AgentEffect;
        if (action.type === "task.create") {
          const task = await createTask({
            ...action,
            userId: action.userId ?? undefined,
            dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
            currentUserId: scoped.userId,
            transaction: tx,
          });
          const after = taskSnapshot(task);
          await tx
            .update(schema.agentProposalTable)
            .set({ after, status: "applied", appliedAt: new Date() })
            .where(eq(schema.agentProposalTable.id, proposalId));
          effect = {
            kind: "task.create",
            task: {
              ...after,
              number: task.number,
              description: task.description,
              position: task.position,
              columnId: task.columnId,
              startDate: task.startDate?.toISOString() ?? null,
              createdAt: task.createdAt.toISOString(),
              updatedAt: task.updatedAt.toISOString(),
            },
          };
        } else if (action.type === "comment.create") {
          effect = await applyComment(tx, scoped, proposalId, action);
        } else {
          await tx
            .select({ id: schema.taskTable.id })
            .from(schema.taskTable)
            .where(eq(schema.taskTable.id, action.taskId))
            .for("update");
          const beforeTask = await getScopedTask(scoped, action.taskId, tx);
          if (
            !proposal.before ||
            !matchesSnapshot(
              taskSnapshot(beforeTask),
              proposal.before,
              Object.keys(action.patch),
            )
          )
            throw new HTTPException(409, {
              message:
                "Task changed since this proposal; refresh and ask again",
            });
          const { dueDate, ...patch } = action.patch;
          const changes = {
            ...patch,
            ...(dueDate !== undefined
              ? { dueDate: dueDate ? new Date(dueDate) : null }
              : {}),
          };
          // Revalidate against the locked task, including dates changed by others.
          if (changes.dueDate !== undefined)
            validateDateRange(beforeTask.startDate, changes.dueDate);
          const [afterTask] = await tx
            .update(schema.taskTable)
            .set(changes)
            .where(eq(schema.taskTable.id, action.taskId))
            .returning();
          if (!afterTask)
            throw new HTTPException(404, { message: "Task not found" });
          await recordTaskMutation(tx, beforeTask, changes, scoped.userId);
          const before = taskSnapshot(beforeTask),
            after = taskSnapshot(afterTask);
          await tx
            .update(schema.agentProposalTable)
            .set({ before, after, status: "applied", appliedAt: new Date() })
            .where(eq(schema.agentProposalTable.id, proposalId));
          effect = { kind: "task.update", before, after };
        }
        await tx
          .insert(schema.agentEffectTable)
          .values({ proposalId, userId: scoped.userId, payload: effect });
        const remaining = await tx
          .select({ id: schema.agentProposalTable.id })
          .from(schema.agentProposalTable)
          .where(
            and(
              eq(schema.agentProposalTable.runId, runId),
              eq(schema.agentProposalTable.status, "pending"),
            ),
          )
          .limit(1);
        if (!remaining.length)
          await tx
            .update(schema.agentRunTable)
            .set({ status: "completed" })
            .where(eq(schema.agentRunTable.id, runId));
      });
      const job = await db.query.agentJobTable.findFirst({
        where: eq(schema.agentJobTable.proposalId, proposalId),
      });
      if (job) await notifyJob(job);
      results.push({
        id: proposalId,
        status: "applied",
        error: null,
        code: null,
      });
    } catch (error) {
      if (!(error instanceof HTTPException)) throw error;
      results.push({
        id: proposalId,
        status: "failed",
        error: error.message,
        code: error.status,
      });
    }
  }
  return { results };
}
