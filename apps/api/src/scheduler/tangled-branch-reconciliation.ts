import { and, eq, notInArray, sql } from "drizzle-orm";
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

export async function reconcileTangledRepositories(): Promise<{
  degraded: boolean;
}> {
  return withJobLease(
    "tangled-branch-reconciliation",
    async () => {
      const started = Date.now();
      let degraded = false;
      const candidates = await db
        .select({
          id: integrationTable.id,
          offset: tangledIntegrationStateTable.scanOffset,
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
        if (Date.now() - started >= 45_000) break;
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
          }).listBranches();
          const staleLinks = await db
            .select({ branch: externalLinkTable.externalId })
            .from(externalLinkTable)
            .where(
              and(
                eq(externalLinkTable.integrationId, connection.id),
                eq(externalLinkTable.resourceType, "branch"),
                notInArray(
                  externalLinkTable.externalId,
                  branches.map((branch) => branch.name),
                ),
              ),
            )
            .orderBy(externalLinkTable.id)
            .limit(20);
          for (const link of staleLinks) {
            if (Date.now() - started >= 45_000) break;
            await removeMissingTangledBranch(connection, link.branch);
          }
          if (!branches.length) continue;
          const offset = Math.max(0, candidate.offset ?? 0) % branches.length;
          let processed = 0;
          // Complete listings are required, but expensive head checks rotate through bounded batches.
          while (
            processed < Math.min(20, branches.length) &&
            (processed === 0 || Date.now() - started < 45_000)
          ) {
            const branch = branches[(offset + processed) % branches.length]!;
            const outcome = await reconcileTangledBranch(
              connection,
              `refs/heads/${branch.name}`,
              "reconciliation",
            );
            if (outcome.outcome === "failed") degraded = true;
            processed++;
          }
          await db
            .update(tangledIntegrationStateTable)
            .set({ scanOffset: (offset + processed) % branches.length })
            .where(
              eq(tangledIntegrationStateTable.integrationId, candidate.id),
            );
        } catch (error) {
          degraded = true;
          logTangledFailure("reconciliation", error);
          if (connection) {
            await withTangledConnection(connection, null, (tx) =>
              recordTangledOutcome(tx, candidate.id, {
                eventType: "reconciliation",
                outcome: "failed",
                code: "upstream_failed",
                ref: null,
              }),
            ).catch((error: unknown) =>
              logTangledFailure("reconciliation", error),
            );
          }
        }
      }
      return { degraded };
    },
    () => ({ degraded: false }),
  );
}
