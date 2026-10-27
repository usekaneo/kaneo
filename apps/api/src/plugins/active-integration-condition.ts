import { and, eq } from "drizzle-orm";
import { integrationTable } from "../database/schema";
import { projectInActiveWorkspace } from "../workspace/archive/active-workspace-sql";

/**
 * An integration acts (webhooks in or out, syncs, reminders) only while it is
 * enabled and its workspace is not archived.
 */
export function activeIntegrationCondition() {
  return and(
    eq(integrationTable.isActive, true),
    projectInActiveWorkspace(integrationTable.projectId),
  );
}
