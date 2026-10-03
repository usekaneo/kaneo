import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  externalLinkTable,
  integrationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { updateExternalLink } from "../../plugins/github/services/link-manager";
import { parseDeferredIssueEdit } from "../../plugins/github/utils/deferred-issue-edit";
import {
  inboundStamp,
  type SyncStamp,
} from "../../plugins/github/utils/sync-echo";
import { formatIssueBody } from "../../plugins/github/utils/format";
import { taskMatchesRule } from "../../plugins/sync/eligibility";
import { readSyncRules } from "../../plugins/sync/rules";
import { reviewSyncResume } from "./review-resume";

// A resume lease performs fresh reads and a nested commit using the pool.
// Queue concurrent requests locally to leave connections available for them.
let resumeQueue: Promise<void> = Promise.resolve();
export async function resumeSync(
  projectId: string,
  provider: string,
  linkId: string,
  token: string,
  source: "kaneo" | "provider",
) {
  const next = resumeQueue.then(() =>
    resumeWithLease(projectId, provider, linkId, token, source),
  );
  resumeQueue = next.then(
    () => {},
    () => {},
  );
  return next;
}

async function resumeWithLease(
  projectId: string,
  provider: string,
  linkId: string,
  token: string,
  source: "kaneo" | "provider",
) {
  await db.transaction(async (lease) => {
    const result = await lease.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(hashtextextended(${`sync-resume:${linkId}`}, 0)) as locked`,
    );
    if (!result.rows[0]?.locked)
      throw new HTTPException(409, {
        message: "This task is already being resumed",
      });
    const review = await reviewSyncResume(projectId, provider, linkId);
    if (review.token !== token)
      throw new HTTPException(409, {
        message: "Task or issue changed; review the comparison again",
      });
    let updatedAt: string | null = null;
    if (source === "kaneo") {
      try {
        updatedAt = (await review.access.write(review.local)).updatedAt;
      } catch {
        throw new HTTPException(502, {
          message: "External issue could not be updated; sync remains paused",
        });
      }
    }
    await db.transaction(async (tx) => {
      const [binding] = await tx
        .select()
        .from(integrationTable)
        .where(
          and(
            eq(integrationTable.id, review.integration.id),
            eq(integrationTable.config, review.integration.config),
            eq(integrationTable.isActive, true),
          ),
        )
        .for("share");
      const [task] = await tx
        .select()
        .from(taskTable)
        .where(
          and(
            eq(taskTable.id, review.task.id),
            eq(taskTable.projectId, projectId),
          ),
        )
        .for("no key update");
      const [link] = await tx
        .select()
        .from(externalLinkTable)
        .where(
          and(
            eq(externalLinkTable.id, linkId),
            eq(externalLinkTable.integrationId, review.integration.id),
            eq(externalLinkTable.taskId, review.task.id),
          ),
        )
        .for("update");
      if (
        !binding ||
        !task ||
        !link ||
        task.updatedAt.getTime() !== review.task.updatedAt.getTime() ||
        link.metadata !== review.link.metadata ||
        !(await taskMatchesRule(
          task.id,
          projectId,
          readSyncRules(binding.config)!.outgoing,
          tx,
        ))
      )
        throw new HTTPException(409, {
          message: "Sync scope or task changed; review again before resuming",
        });
      if (source === "provider") {
        const final = review.remote.state === "closed";
        const columns = await tx
          .select()
          .from(columnTable)
          .where(eq(columnTable.projectId, projectId))
          .orderBy(asc(columnTable.position));
        const current = columns.find((column) => column.id === task.columnId);
        const target =
          current?.isFinal === final
            ? current
            : columns.find((column) => column.isFinal === final);
        if (!target)
          throw new HTTPException(409, {
            message: "A matching open or completed column is required",
          });
        await tx
          .update(taskTable)
          .set({
            title: review.remote.title,
            description: review.remote.description,
            status: target.slug,
            columnId: target.id,
          })
          .where(eq(taskTable.id, task.id));
      }
      const job = parseDeferredIssueEdit(
        JSON.parse(link.metadata ?? "{}").deferredIssueEdit,
      );
      for (const field of ["title", "description", "state"] as const) {
        await updateExternalLink(
          linkId,
          {
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
              state: review[source === "kaneo" ? "local" : "remote"].state,
            },
            retireUncertainOutbound: field,
          },
          tx,
        );
      }
    });
    await publishEvent("task.updated", { projectId, taskId: review.task.id });
    await publishEvent("project.updated", { projectId });
  });
  return { success: true };
}
