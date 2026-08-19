import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { isBillingEnabled } from "../billing/config";
import { syncWorkspaceSeats } from "../billing/controllers/sync-seats";
import db from "../database";
import { workspaceBillingTable, workspaceUserTable } from "../database/schema";

const BATCH_SIZE = 100;

async function findDriftedWorkspaces() {
  return db
    .select({ workspaceId: workspaceBillingTable.workspaceId })
    .from(workspaceBillingTable)
    .innerJoin(
      workspaceUserTable,
      eq(workspaceUserTable.workspaceId, workspaceBillingTable.workspaceId),
    )
    .where(
      and(
        eq(workspaceBillingTable.plan, "team"),
        inArray(workspaceBillingTable.status, ["active", "trialing"]),
        isNotNull(workspaceBillingTable.creemSubscriptionId),
        isNotNull(workspaceBillingTable.creemProductId),
      ),
    )
    .groupBy(workspaceBillingTable.workspaceId, workspaceBillingTable.seats)
    .having(
      sql`${count(workspaceUserTable.userId)} <> ${workspaceBillingTable.seats}`,
    )
    .limit(BATCH_SIZE);
}

export async function reconcileWorkspaceSeats(): Promise<{
  degraded: boolean;
}> {
  if (!isBillingEnabled()) {
    return { degraded: false };
  }

  let drifted: Awaited<ReturnType<typeof findDriftedWorkspaces>>;
  try {
    drifted = await findDriftedWorkspaces();
  } catch (error) {
    console.error("billing: seat reconciliation query failed", error);
    return { degraded: true };
  }

  if (drifted.length === 0) {
    return { degraded: false };
  }

  let repaired = 0;
  let degraded = false;
  for (const { workspaceId } of drifted) {
    try {
      await syncWorkspaceSeats(workspaceId);
      repaired += 1;
    } catch (error) {
      degraded = true;
      console.error(
        `billing: seat reconciliation failed for workspace ${workspaceId}`,
        error,
      );
    }
  }

  console.log(
    `billing: seat reconciliation resynced ${repaired}/${drifted.length} workspaces`,
  );
  return { degraded };
}
