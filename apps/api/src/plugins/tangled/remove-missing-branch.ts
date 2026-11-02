import { and, eq } from "drizzle-orm";
import { externalLinkTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { findExternalLink } from "../github/services/link-manager";
import { withTangledConnection, type TangledConnection } from "./connection";
import { createTangledReadClient } from "./read-client";
import { TangledRefNotFoundError } from "./request-json";

export async function removeMissingTangledBranch(
  connection: TangledConnection,
  branch: string,
): Promise<boolean> {
  const ref = `refs/heads/${branch}`;
  let removedTaskId: string | undefined;
  await withTangledConnection(connection, ref, async (tx) => {
    const client = createTangledReadClient({
      origin: connection.parsed.origin,
      repositoryDid: connection.parsed.repositoryDid,
    });
    const repository = await client.getRepository();
    if (
      repository.webhookRepositoryFullName !==
      connection.parsed.repositoryFullName
    ) {
      throw new Error("Tangled repository binding changed");
    }
    try {
      await client.getBranch(ref);
      return;
    } catch (error) {
      if (!(error instanceof TangledRefNotFoundError)) throw error;
    }
    const link = await findExternalLink(connection.id, "branch", branch, tx);
    if (!link) return;
    const [task] = await tx
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.id, link.taskId),
          eq(taskTable.projectId, connection.projectId),
        ),
      )
      .for("no key update");
    if (!task) return;
    const [removed] = await tx
      .delete(externalLinkTable)
      .where(
        and(
          eq(externalLinkTable.id, link.id),
          eq(externalLinkTable.integrationId, connection.id),
          eq(externalLinkTable.taskId, task.id),
          eq(externalLinkTable.resourceType, "branch"),
        ),
      )
      .returning({ taskId: externalLinkTable.taskId });
    removedTaskId = removed?.taskId;
  });
  if (removedTaskId)
    await publishEvent("task.updated", {
      projectId: connection.projectId,
      taskId: removedTaskId,
    });
  return removedTaskId !== undefined;
}
