import { canSyncTask, taskMatchesRule } from "../../sync/eligibility";
import { isSyncPaused, readSyncRules } from "../../sync/rules";
import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import * as v from "valibot";
import db from "../../../database";
import {
  externalLinkTable,
  integrationTable,
  labelTable,
  projectTable,
  taskTable,
} from "../../../database/schema";
import {
  canSyncGiteaIssues,
  giteaConfigSchema,
  normalizeGiteaBaseUrl,
  type GiteaConfig,
} from "../config";
import type { SyncStamp } from "../../github/utils/sync-echo";

export type GiteaOutboundBinding = {
  integrationId: string;
  projectId: string;
  config: GiteaConfig;
  taskId?: string;
  link?: { id: string; taskId: string; externalId?: string };
  intent?: { field: "title" | "description" | "state"; intentId: string };
  resumePaused?: boolean;
};

export type GiteaWriteResult<T> = { sent: false } | { sent: true; value: T };

function sameConfig(saved: string, expected: GiteaConfig): boolean {
  try {
    const parsed = v.parse(giteaConfigSchema, JSON.parse(saved));
    const wanted = v.parse(giteaConfigSchema, expected);
    return (
      canSyncGiteaIssues(parsed) &&
      isDeepStrictEqual(
        {
          ...parsed,
          baseUrl: normalizeGiteaBaseUrl(parsed.baseUrl),
          issueSyncMode: parsed.issueSyncMode ?? "sync",
        },
        {
          ...wanted,
          baseUrl: normalizeGiteaBaseUrl(wanted.baseUrl),
          issueSyncMode: wanted.issueSyncMode ?? "sync",
        },
      )
    );
  } catch {
    return false;
  }
}

const MAX_CONCURRENT_OUTBOUND_FENCES = 4;
let activeOutboundFences = 0;
const waitingOutboundFences: Array<() => void> = [];

async function acquireOutboundFence(): Promise<void> {
  if (activeOutboundFences < MAX_CONCURRENT_OUTBOUND_FENCES) {
    activeOutboundFences++;
    return;
  }
  await new Promise<void>((resolve) => waitingOutboundFences.push(resolve));
}

function releaseOutboundFence(): void {
  const next = waitingOutboundFences.shift();
  if (next) next();
  else activeOutboundFences--;
}

/** Serialize one bounded provider mutation with settings saves. The callback must
 * not acquire a database connection, lock task/link rows, or compose requests.
 * Completion metadata is recorded after this transaction releases its lock.
 * At most four fences per process use the main pool; FIFO waiters acquire no
 * connection. Integration and eligibility locks remain held through bounded HTTP.
 */
export async function withGiteaOutboundWrite<T>(
  binding: GiteaOutboundBinding,
  write: () => Promise<T>,
): Promise<GiteaWriteResult<T>> {
  await acquireOutboundFence();
  let completed: { sent: true; value: T } | undefined;
  try {
    if (binding.link) {
      const expectedLink = binding.link;
      const admitted = await db.transaction(async (tx) => {
        // Match settings→link lock ordering, but release link locks before HTTP.
        const [integration] = await tx
          .select({ id: integrationTable.id })
          .from(integrationTable)
          .where(eq(integrationTable.id, binding.integrationId))
          .for("share");
        if (!integration) return false;
        const [link] = await tx
          .select()
          .from(externalLinkTable)
          .where(
            and(
              eq(externalLinkTable.id, expectedLink.id),
              eq(externalLinkTable.integrationId, binding.integrationId),
              eq(externalLinkTable.taskId, expectedLink.taskId),
              eq(externalLinkTable.resourceType, "issue"),
            ),
          )
          .for("update");
        return (
          !!link &&
          (expectedLink.externalId === undefined ||
            link.externalId === expectedLink.externalId) &&
          (binding.resumePaused || !isSyncPaused(link.metadata))
        );
      });
      if (!admitted) return { sent: false };
    }
    return await db.transaction(async (tx): Promise<GiteaWriteResult<T>> => {
      const [integration] = await tx
        .select()
        .from(integrationTable)
        .where(eq(integrationTable.id, binding.integrationId))
        .for("share");
      if (
        !integration ||
        integration.isActive !== true ||
        integration.type !== "gitea" ||
        integration.projectId !== binding.projectId ||
        !sameConfig(integration.config, binding.config)
      )
        return { sent: false };

      const taskId = binding.link?.taskId ?? binding.taskId;
      if (taskId) {
        const [task] = await tx
          .select({ id: taskTable.id })
          .from(taskTable)
          .where(
            and(
              eq(taskTable.id, taskId),
              eq(taskTable.projectId, binding.projectId),
            ),
          );
        if (!task) return { sent: false };
        const rule = readSyncRules(integration.config)?.outgoing;
        if (rule?.mode === "labels") {
          const project = await tx.query.projectTable.findFirst({
            where: eq(projectTable.id, binding.projectId),
          });
          if (!project) return { sent: false };
          await tx
            .select({ id: labelTable.id })
            .from(labelTable)
            .where(
              and(
                eq(labelTable.workspaceId, project.workspaceId),
                or(
                  and(
                    isNull(labelTable.taskId),
                    inArray(labelTable.id, rule.labels),
                  ),
                  eq(labelTable.taskId, taskId),
                ),
              ),
            )
            .orderBy(labelTable.id)
            .for("share");
        }
        const eligible = binding.resumePaused
          ? !!rule &&
            (await taskMatchesRule(taskId, binding.projectId, rule, tx))
          : await canSyncTask(taskId, integration.id, tx, integration.config);
        if (!eligible) return { sent: false };
      }
      if (binding.intent && !binding.link) return { sent: false };
      if (binding.link) {
        // Nonlocking reads deliberately allow task edits and inbound deliveries
        // while HTTP is in flight. Mode retirement first takes the integration lock.
        const [link] = await tx
          .select()
          .from(externalLinkTable)
          .where(
            and(
              eq(externalLinkTable.id, binding.link.id),
              eq(externalLinkTable.integrationId, binding.integrationId),
              eq(externalLinkTable.taskId, binding.link.taskId),
              eq(externalLinkTable.resourceType, "issue"),
            ),
          );
        if (
          !link ||
          (binding.link.externalId !== undefined &&
            link.externalId !== binding.link.externalId)
        )
          return { sent: false };
        if (binding.intent) {
          try {
            const metadata = JSON.parse(link.metadata ?? "{}") as {
              lastSync?: Partial<
                Record<"title" | "description" | "state", SyncStamp>
              >;
            };
            const intent = metadata.lastSync?.[
              binding.intent.field
            ]?.outbound?.find(
              (entry) => entry.intentId === binding.intent!.intentId,
            );
            if (!intent || intent.cancelled || !intent.pending)
              return { sent: false };
          } catch {
            return { sent: false };
          }
        }
      }
      completed = { sent: true, value: await write() };
      return completed;
    });
  } catch (error) {
    if (!completed) throw error;
    // A failed scope commit cannot undo the successful provider mutation.
    // Preserve its exact result so callers persist the receipt outside this scope.
    console.error("Issue write scope transaction failed after dispatch", {
      integrationId: binding.integrationId,
      linkId: binding.link?.id,
    });
    return completed;
  } finally {
    releaseOutboundFence();
  }
}
