import type { AdminWorkspace } from "@/fetchers/admin/workspace-types";

export type PendingWorkspaceAction = {
  type: "archive" | "restore" | "delete";
  workspace: AdminWorkspace;
};
