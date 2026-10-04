import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { updateExternalLink } from "../../plugins/github/services/link-manager";
import { parseDeferredIssueEdit } from "../../plugins/github/utils/deferred-issue-edit";
import {
  inboundStamp,
  type SyncStamp,
} from "../../plugins/github/utils/sync-echo";
import { formatIssueBody } from "../../plugins/github/utils/format";
import { reviewSyncResume } from "./review-resume";
import { lockResumeScope } from "./lock-resume-scope";
import { withSyncLease } from "../../plugins/sync/lease";
import {
  publishTaskMutation,
  recordTaskMutation,
  type TaskBefore,
} from "../../task/controllers/task-mutation-effects";

export async function resumeSync(
  projectId: string,
  provider: string,
  linkId: string,
  token: string,
  source: "kaneo" | "provider",
) {
  return withSyncLease(`sync-resume:${linkId}`, () =>
    resumeWithLease(projectId, provider, linkId, token, source),
  );
}

async function resumeWithLease(
  projectId: string,
  provider: string,
  linkId: string,
  token: string,
  source: "kaneo" | "provider",
) {
  let providerWritten = false;
  let adoption:
    | { before: TaskBefore; after: TaskBefore; integrationId: string }
    | undefined;
  let taskId: string | undefined;
  try {
    await db.transaction(async (tx) => {
      await lockResumeScope(projectId, provider, linkId, tx);
      const review = await reviewSyncResume(projectId, provider, linkId, tx);
      taskId = review.task.id;
      const task = review.task;
      const link = review.link;
      if (review.token !== token)
        throw new HTTPException(409, {
          message: "Task or issue changed; review the comparison again",
        });
      let updatedAt: string | null = null;
      if (source === "kaneo") {
        try {
          updatedAt = (await review.access.write(review.local)).updatedAt;
          providerWritten = true;
        } catch {
          throw new HTTPException(502, {
            message: "External issue could not be updated; sync remains paused",
          });
        }
      }
      if (source === "provider") {
        let status = { status: task.status, columnId: task.columnId };
        if (review.local.state !== review.remote.state) {
          const columns = await tx
            .select()
            .from(columnTable)
            .where(eq(columnTable.projectId, projectId))
            .orderBy(asc(columnTable.position));
          const target = columns.find(
            (column) => column.isFinal === (review.remote.state === "closed"),
          );
          if (!target)
            throw new HTTPException(409, {
              message: "A matching open or completed column is required",
            });
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
          linkId,
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
    });
  } catch (error) {
    if (providerWritten) {
      // A database failure after a successful provider write must remain visible
      // to the next review. The link stays paused and clients refresh both sides.
      await updateExternalLink(linkId, {
        metadata: { syncFilterPaused: true, syncResumeUncertain: true },
      });
      await publishEvent("project.updated", { projectId });
      if (taskId) await publishEvent("task.updated", { projectId, taskId });
    }
    throw error;
  }
  if (adoption)
    await publishTaskMutation(adoption.before, adoption.after, undefined, {
      fields: ["title", "description", "status"],
      sourceIntegrationId: adoption.integrationId,
    });
  await publishEvent("task.updated", { projectId, taskId });
  await publishEvent("project.updated", { projectId });
  return { success: true };
}
