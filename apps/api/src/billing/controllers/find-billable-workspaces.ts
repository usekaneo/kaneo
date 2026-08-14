import { eq, inArray } from "drizzle-orm";
import db from "../../database";
import { workspaceBillingTable, workspaceTable } from "../../database/schema";
import { isBillingEnabled } from "../config";
import { hasBillableSubscription } from "../subscription-state";

export async function findBillableWorkspaces(workspaceIds: string[]) {
  if (!isBillingEnabled() || workspaceIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      workspaceId: workspaceBillingTable.workspaceId,
      name: workspaceTable.name,
      creemSubscriptionId: workspaceBillingTable.creemSubscriptionId,
      status: workspaceBillingTable.status,
    })
    .from(workspaceBillingTable)
    .innerJoin(
      workspaceTable,
      eq(workspaceTable.id, workspaceBillingTable.workspaceId),
    )
    .where(inArray(workspaceBillingTable.workspaceId, workspaceIds));

  return rows
    .filter(hasBillableSubscription)
    .map((row) => ({ workspaceId: row.workspaceId, name: row.name }));
}

export function formatBillableWorkspacesMessage(names: string[]) {
  const quoted = names.map((name) => `"${name}"`);
  const list =
    quoted.length === 1
      ? quoted[0]
      : `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;

  return `${list} still ${names.length === 1 ? "has" : "have"} an active subscription. Cancel it in billing settings before deleting.`;
}

export default findBillableWorkspaces;
