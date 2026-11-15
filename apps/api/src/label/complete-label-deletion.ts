import { and, eq, sql } from "drizzle-orm";
import db from "../database";
import type { RequestLease } from "../database/request-lease";
import {
  labelDeletionTable,
  projectTable,
  taskTable,
} from "../database/schema";
import { publishEvent } from "../events";
import { removeLabelFromGitea } from "../plugins/gitea/utils/sync-label-to-gitea";
import { removeLabelFromGitHub } from "../plugins/github/utils/sync-label-to-github";
import { removeLabelFromGitlab } from "../plugins/gitlab/utils/sync-label-to-gitlab";

export async function completeLabelDeletion(
  pending: typeof labelDeletionTable.$inferSelect,
  lease: RequestLease,
) {
  const { deletionId: _deletionId, pendingEffects, userId, ...label } = pending;
  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskTable.id, label.taskId ?? ""),
        eq(projectTable.workspaceId, label.workspaceId ?? ""),
      ),
    )
    .limit(1);
  // Legacy inconsistent rows may be cleaned up, but never emit foreign events.
  if (task) {
    const providers = {
      github: removeLabelFromGitHub,
      gitea: removeLabelFromGitea,
      gitlab: removeLabelFromGitlab,
    };
    for (const effect of pendingEffects) {
      await lease.check();
      if (effect === "event") {
        await publishEvent(
          "task.label_deleted",
          {
            label,
            task,
            projectId: task.projectId,
            taskId: task.id,
            userId,
            type: "label_deleted",
          },
          { waitForHandlers: true },
        );
      } else {
        try {
          await providers[effect](task.id, label.name);
        } catch {
          // Provider synchronization remains best effort: acknowledge the
          // attempt, even if the provider is unavailable.
          console.error(
            "Failed to synchronize a label removal with an external provider",
          );
        }
      }
      // An operation whose acknowledgement is lost may be replayed. Never
      // discard an unattempted effect, or let an expired owner acknowledge.
      await lease.transaction((tx) =>
        tx
          .update(labelDeletionTable)
          .set({
            pendingEffects: sql`array_remove(${labelDeletionTable.pendingEffects}, ${effect})`,
          })
          .where(eq(labelDeletionTable.id, label.id)),
      );
    }
  }
  await lease.transaction((tx) =>
    tx.delete(labelDeletionTable).where(eq(labelDeletionTable.id, label.id)),
  );
  return label;
}
