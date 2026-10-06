import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { columnTable, taskTable } from "../../database/schema";
import { updateExternalLink } from "../../plugins/github/services/link-manager";
import { parseDeferredIssueEdit } from "../../plugins/github/utils/deferred-issue-edit";
import {
  inboundStamp,
  type SyncStamp,
} from "../../plugins/github/utils/sync-echo";
import { formatIssueBody } from "../../plugins/github/utils/format";
import { resolveTargetStatus as resolveGithubStatus } from "../../plugins/github/utils/resolve-column";
import { resolveTargetStatus as resolveGiteaStatus } from "../../plugins/gitea/utils/resolve-column";
import { resolveTargetStatus as resolveGitlabStatus } from "../../plugins/gitlab/utils/resolve-column";
import {
  recordTaskMutation,
  type TaskBefore,
} from "../../task/controllers/task-mutation-effects";
import type { reviewSyncResume } from "./review-resume";

export async function applySyncResume(
  review: Awaited<ReturnType<typeof reviewSyncResume>>,
  provider: string,
  source: "kaneo" | "provider",
  updatedAt: string | null,
  tx: Parameters<typeof recordTaskMutation>[0],
) {
  const { task, link } = review;
  let adoption:
    | { before: TaskBefore; after: TaskBefore; integrationId: string }
    | undefined;
  if (source === "provider") {
    let status = { status: task.status, columnId: task.columnId };
    if (review.local.state !== review.remote.state) {
      const columns = await tx
        .select()
        .from(columnTable)
        .where(eq(columnTable.projectId, task.projectId))
        .orderBy(asc(columnTable.position));
      const fallback = columns.find(
        (column) => column.isFinal === (review.remote.state === "closed"),
      );
      if (!fallback)
        throw new HTTPException(409, {
          message: "A matching open or completed column is required",
        });
      const resolveStatus =
        provider === "gitea"
          ? resolveGiteaStatus
          : provider === "gitlab"
            ? resolveGitlabStatus
            : resolveGithubStatus;
      const slug = await resolveStatus(
        task.projectId,
        review.remote.state === "closed" ? "issue_closed" : "issue_reopened",
        fallback.slug,
        tx,
      );
      const target = columns.find((column) => column.slug === slug)!;
      status = { status: target.slug, columnId: target.id };
    }
    const [after] = await tx
      .update(taskTable)
      .set({
        title: review.remote.title,
        description: review.remote.description,
        ...status,
      })
      .where(eq(taskTable.id, task.id))
      .returning();
    await recordTaskMutation(tx, task, after!);
    adoption = {
      before: task,
      after: after!,
      integrationId: review.integration.id,
    };
  }
  const job = parseDeferredIssueEdit(
    JSON.parse(link.metadata ?? "{}").deferredIssueEdit,
  );
  for (const field of ["title", "description", "state"] as const) {
    await updateExternalLink(
      link.id,
      {
        ...(field === "title"
          ? { title: review[source === "kaneo" ? "local" : "remote"].title }
          : {}),
        ...(source === "kaneo" && provider !== "gitlab"
          ? {
              outbound: {
                field,
                value: review.local[field],
                intentId: randomUUID(),
                updatedAt: updatedAt ?? undefined,
                pending: false,
              },
            }
          : {}),
        ...(job ? { completeDeferredEdit: job.id } : {}),
        metadata: {
          syncFilterPaused: false,
          syncResumeUncertain: false,
          syncResumeLabelBaseline: review.remoteIssueLabels,
          ...(provider === "gitlab"
            ? {
                lastOutboundStateSyncAt: Date.now(),
                lastSync: {
                  title: {
                    source: source === "kaneo" ? "kaneo" : "gitlab",
                    value:
                      review[source === "kaneo" ? "local" : "remote"].title,
                    timestamp: new Date().toISOString(),
                  },
                  description: {
                    source: source === "kaneo" ? "kaneo" : "gitlab",
                    value:
                      source === "kaneo"
                        ? formatIssueBody(review.local.description, task.id)
                        : review.remote.description,
                    timestamp: new Date().toISOString(),
                  },
                },
              }
            : {}),
          ...(source === "provider" && provider !== "gitlab"
            ? {
                lastSync: {
                  [field]: inboundStamp(
                    (
                      JSON.parse(link.metadata ?? "{}").lastSync as
                        | Record<string, SyncStamp>
                        | undefined
                    )?.[field],
                    review.remote[field],
                    provider,
                    review.remoteIssueUpdatedAt ?? undefined,
                  ),
                },
              }
            : {}),
          state:
            provider === "gitlab" &&
            review[source === "kaneo" ? "local" : "remote"].state === "open"
              ? "opened"
              : review[source === "kaneo" ? "local" : "remote"].state,
        },
        retireUncertainOutbound: field,
      },
      tx,
    );
  }
  return adoption;
}
