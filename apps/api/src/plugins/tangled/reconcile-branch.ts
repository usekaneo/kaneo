import { and, eq } from "drizzle-orm";
import {
  projectTable,
  tangledTaskOwnershipTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { getSubtaskParentProjects } from "../../task/get-subtask-parent-projects";
import {
  createOrUpdateExternalLink,
  findExternalLink,
} from "../github/services/link-manager";
import { extractTaskNumberFromBranch } from "../github/utils/branch-matcher";
import { tangledRefSchema } from "./api-contract";
import { applyTangledWorkflow } from "./apply-workflow";
import { logTangledFailure } from "./log-failure";
import { withTangledConnection, type TangledConnection } from "./connection";
import type { TangledOutcome } from "./outcome-types";
import { createTangledReadClient } from "./read-client";
import { recordTangledOutcome } from "./record-outcome";
import { TangledRefNotFoundError } from "./request-json";
import { storedBranchHead } from "./stored-branch-head";

export async function reconcileTangledBranch(
  connection: TangledConnection,
  ref: string,
  eventType: "push" | "reconciliation" = "push",
): Promise<TangledOutcome> {
  if (
    ref.length > 1024 ||
    !tangledRefSchema.shape.name.safeParse(ref).success
  ) {
    throw new Error("Invalid Tangled branch reference");
  }
  let changedTaskId: string | null = null;
  const workflow: {
    change: Awaited<ReturnType<typeof applyTangledWorkflow>>;
    taskId: string | null;
  } = { change: null, taskId: null };
  const result = await withTangledConnection(
    connection,
    ref,
    async (tx): Promise<TangledOutcome> => {
      const finish = async (
        outcome: TangledOutcome["outcome"],
        code: TangledOutcome["code"],
      ): Promise<TangledOutcome> => {
        const result = { eventType, outcome, code, ref };
        await recordTangledOutcome(tx, connection.id, result);
        return result;
      };
      const project = await tx.query.projectTable.findFirst({
        where: eq(projectTable.id, connection.projectId),
      });
      if (!project) throw new Error("Tangled project no longer exists");
      const branch = ref.slice("refs/heads/".length);
      const number = extractTaskNumberFromBranch(
        branch,
        connection.parsed,
        project.slug,
      );
      if (number === null || !Number.isSafeInteger(number) || number < 1)
        return finish("skipped", "branch_unmatched");
      const client = createTangledReadClient({
        origin: connection.parsed.origin,
        repositoryDid: connection.parsed.repositoryDid,
      });
      let repository: Awaited<ReturnType<typeof client.getRepository>>;
      try {
        repository = await client.getRepository();
      } catch (error) {
        logTangledFailure("repository_lookup", error);
        return finish("failed", "upstream_failed");
      }
      if (
        repository.webhookRepositoryFullName !==
        connection.parsed.repositoryFullName
      ) {
        return finish("failed", "repository_changed");
      }
      let head: { oid: string };
      try {
        head = await client.getBranch(ref);
      } catch (error) {
        if (error instanceof TangledRefNotFoundError)
          return finish("skipped", "branch_missing");
        logTangledFailure("branch_lookup", error);
        return finish("failed", "upstream_failed");
      }
      const [task] = await tx
        .select({ id: taskTable.id, statusRevision: taskTable.statusRevision })
        .from(taskTable)
        .where(
          and(
            eq(taskTable.projectId, connection.projectId),
            eq(taskTable.number, number),
          ),
        )
        .for("no key update");
      if (!task) return finish("skipped", "task_not_found");
      const url = new URL(connection.parsed.repositoryUrl);
      url.pathname = `${url.pathname.replace(/\/$/, "")}/tree/${encodeURIComponent(branch)}`;
      url.search = "";
      url.hash = "";
      const metadata = JSON.stringify({ lastCommit: { sha: head.oid } });
      const existing = await findExternalLink(
        connection.id,
        "branch",
        branch,
        tx,
      );
      if (existing && existing.taskId !== task.id) {
        return finish("skipped", "branch_conflict");
      }
      const previousHead = storedBranchHead(existing?.metadata ?? null);
      if (eventType === "reconciliation" && previousHead === null) {
        await tx
          .insert(tangledTaskOwnershipTable)
          .values({
            taskId: task.id,
            integrationId: connection.id,
            statusRevision: task.statusRevision,
          })
          .onConflictDoNothing();
      }
      if (
        eventType === "push" ||
        (previousHead !== null && previousHead !== head.oid)
      ) {
        workflow.change = await applyTangledWorkflow(tx, connection, task.id);
        if (workflow.change) workflow.taskId = task.id;
      }
      if (
        existing?.taskId === task.id &&
        existing.url === url.href &&
        existing.title === branch &&
        existing.metadata === metadata
      ) {
        return finish("skipped", "branch_unchanged");
      }
      await createOrUpdateExternalLink(
        {
          taskId: task.id,
          integrationId: connection.id,
          resourceType: "branch",
          externalId: branch,
          url: url.href,
          title: branch,
          metadata: { lastCommit: { sha: head.oid } },
        },
        tx,
      );
      changedTaskId = task.id;
      return finish("applied", "branch_linked");
    },
  );
  if (workflow.change !== null && workflow.taskId !== null) {
    if (workflow.change.statusChange)
      await publishEvent("task.status_changed", workflow.change.statusChange);
    else if (workflow.change.columnChanged)
      await publishEvent("subtask-parents.refresh", {
        projects: await getSubtaskParentProjects([workflow.taskId]),
      });
    await publishEvent("task-relation.refresh", {
      projectId: connection.projectId,
    });
  }
  const updatedTaskId = changedTaskId ?? workflow.taskId;
  if (updatedTaskId !== null)
    await publishEvent("task.updated", {
      projectId: connection.projectId,
      taskId: updatedTaskId,
    });
  return result;
}
