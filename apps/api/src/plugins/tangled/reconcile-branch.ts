import { and, eq } from "drizzle-orm";
import { projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import {
  createOrUpdateExternalLink,
  findExternalLink,
} from "../github/services/link-manager";
import { extractTaskNumberFromBranch } from "../github/utils/branch-matcher";
import { tangledRefSchema } from "./api-contract";
import { applyTangledWorkflow } from "./apply-workflow";
import { withTangledConnection, type TangledConnection } from "./connection";
import type { TangledOutcome } from "./outcome-types";
import { createTangledReadClient } from "./read-client";
import { recordTangledOutcome } from "./record-outcome";
import { TangledRefNotFoundError } from "./request-json";

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
  let statusChange: Awaited<ReturnType<typeof applyTangledWorkflow>> = null;
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
      } catch {
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
        return finish("failed", "upstream_failed");
      }
      const [task] = await tx
        .select({ id: taskTable.id })
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
      statusChange = await applyTangledWorkflow(tx, connection, task.id);
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
  if (statusChange !== null)
    await publishEvent("task.status_changed", statusChange);
  if (changedTaskId !== null)
    await publishEvent("task.updated", {
      projectId: connection.projectId,
      taskId: changedTaskId,
    });
  return result;
}
