import { deleteWorkspaceData } from "../../workspace/lifecycle/delete-workspace-data";
import type { AdminAuditRequest } from "../audit/admin-audit-request";

async function deleteWorkspace(workspaceId: string, audit: AdminAuditRequest) {
  const workspace = await deleteWorkspaceData(workspaceId, audit);
  return { id: workspace.id };
}

export default deleteWorkspace;
