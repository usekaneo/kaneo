import { and, eq, gt, notInArray, sql } from "drizzle-orm";
import db from "../database";
import {
  integrationTable,
  externalLinkTable,
  tangledIntegrationStateTable,
} from "../database/schema";
import { activeIntegrationCondition } from "../plugins/active-integration-condition";
import {
  loadTangledConnection,
  withTangledConnection,
  type TangledConnection,
} from "../plugins/tangled/connection";
import { createTangledReadClient } from "../plugins/tangled/read-client";
import { logTangledFailure } from "../plugins/tangled/log-failure";
import { reconcileTangledBranch } from "../plugins/tangled/reconcile-branch";
import { removeMissingTangledBranch } from "../plugins/tangled/remove-missing-branch";
import { recordTangledOutcome } from "../plugins/tangled/record-outcome";
import { withJobLease } from "./leader-lock";

const STALE_LINK_BATCH_SIZE = 20;

export async function reconcileTangledRepositories(): Promise<{
  degraded: boolean;
}> {
  return withJobLease(
    "tangled-branch-reconciliation",
    async () => {
      const deadline = Date.now() + 45_000;
      let degraded = false;
      const recordFailure = async (
        error: unknown,
        connection: TangledConnection | undefined,
        ref: string | null,
      ) => {
        degraded = true;
        logTangledFailure("reconciliation", error);
        if (connection) {
          await withTangledConnection(connection, null, (tx) =>
            recordTangledOutcome(tx, connection.id, {
              eventType: "reconciliation",
              outcome: "failed",
              code: "upstream_failed",
              ref,
            }),
          ).catch((error: unknown) =>
            logTangledFailure("reconciliation", error),
          );
        }
      };
      const candidates = await db
        .select({
          id: integrationTable.id,
          offset: tangledIntegrationStateTable.scanOffset,
          staleLinkCursor: tangledIntegrationStateTable.staleLinkCursor,
        })
        .from(integrationTable)
        .leftJoin(
          tangledIntegrationStateTable,
          eq(tangledIntegrationStateTable.integrationId, integrationTable.id),
        )
        .where(
          and(
            eq(integrationTable.type, "tangled"),
            activeIntegrationCondition(),
          ),
        )
        .orderBy(
          sql`${tangledIntegrationStateTable.lastScanAt} asc nulls first`,
          integrationTable.id,
        )
        .limit(3);
      for (const candidate of candidates) {
        if (Date.now() >= deadline) break;
        let connection: TangledConnection | undefined;
        try {
          // Failed connections also rotate to the back instead of starving healthy ones.
          await db
            .insert(tangledIntegrationStateTable)
            .values({ integrationId: candidate.id, lastScanAt: new Date() })
            .onConflictDoUpdate({
              target: tangledIntegrationStateTable.integrationId,
              set: { lastScanAt: new Date() },
            });
          connection = await loadTangledConnection(candidate.id);
          const branches = await createTangledReadClient({
            origin: connection.parsed.origin,
            repositoryDid: connection.parsed.repositoryDid,
            deadline,
          }).listBranches();
          const remaining = deadline - Date.now();
          if (remaining <= 0) continue;
          // Leave up to 20 seconds for listed branches, splitting the time
          // evenly when the listing has already used part of the budget.
          const staleDeadline = branches.length
            ? deadline - Math.min(20_000, Math.floor(remaining / 2))
            : deadline;
          let staleLinkCursor = candidate.staleLinkCursor;
          const staleLinks = await db
            .select({
              id: externalLinkTable.id,
              branch: externalLinkTable.externalId,
            })
            .from(externalLinkTable)
            .where(
              and(
                eq(externalLinkTable.integrationId, connection.id),
                eq(externalLinkTable.resourceType, "branch"),
                staleLinkCursor === null
                  ? undefined
                  : gt(externalLinkTable.id, staleLinkCursor),
                notInArray(
                  externalLinkTable.externalId,
                  branches.map((branch) => branch.name),
                ),
              ),
            )
            .orderBy(externalLinkTable.id)
            .limit(STALE_LINK_BATCH_SIZE + 1);
          let checkedLinks = 0;
          for (
            ;
            checkedLinks < Math.min(STALE_LINK_BATCH_SIZE, staleLinks.length) &&
            Date.now() < staleDeadline;
            checkedLinks++
          ) {
            const link = staleLinks[checkedLinks]!;
            try {
              await removeMissingTangledBranch(
                connection,
                link.branch,
                staleDeadline,
              );
            } catch (error) {
              await recordFailure(
                error,
                connection,
                `refs/heads/${link.branch}`,
              );
            }
            staleLinkCursor = link.id;
          }
          // Revisit failed links and IDs inserted behind the cursor next pass.
          if (checkedLinks === staleLinks.length) staleLinkCursor = null;
          const offset = branches.length
            ? Math.max(0, candidate.offset ?? 0) % branches.length
            : 0;
          let processed = 0;
          // Complete listings are required, but expensive head checks rotate through bounded batches.
          for (
            ;
            processed < Math.min(20, branches.length) && Date.now() < deadline;
            processed++
          ) {
            const branch = branches[(offset + processed) % branches.length]!;
            const ref = `refs/heads/${branch.name}`;
            try {
              const outcome = await reconcileTangledBranch(
                connection,
                ref,
                "reconciliation",
                deadline,
              );
              if (outcome.outcome === "failed") degraded = true;
            } catch (error) {
              await recordFailure(error, connection, ref);
            }
          }
          await db
            .update(tangledIntegrationStateTable)
            .set({
              staleLinkCursor,
              scanOffset: branches.length
                ? (offset + processed) % branches.length
                : undefined,
            })
            .where(
              eq(tangledIntegrationStateTable.integrationId, candidate.id),
            );
        } catch (error) {
          await recordFailure(error, connection, null);
        }
      }
      return { degraded };
    },
    () => ({ degraded: false }),
  );
}
