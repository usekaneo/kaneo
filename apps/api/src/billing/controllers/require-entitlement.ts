import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { isBillingEnabled } from "../config";
import {
  computeEntitlement,
  getOrCreateWorkspaceBilling,
} from "./get-workspace-billing";

export async function requireWorkspaceEntitlement(workspaceId: string) {
  if (!isBillingEnabled()) {
    return;
  }

  const billing = await getOrCreateWorkspaceBilling(workspaceId);
  const entitlement = computeEntitlement(billing);

  if (!entitlement.active) {
    throw new HTTPException(402, {
      message:
        "This workspace's Kaneo Cloud plan has expired. Subscribe to continue creating and editing.",
    });
  }
}

export async function requireProjectEntitlement(projectId: string) {
  if (!isBillingEnabled()) {
    return;
  }

  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId));

  if (!project) {
    return;
  }

  await requireWorkspaceEntitlement(project.workspaceId);
}
