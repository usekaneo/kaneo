import type { PermissionMap } from "../utils/require-workspace-permission";
import type { AgentAction } from "./types";

export function actionPermissions(action: AgentAction): PermissionMap {
  if (action.type === "code.run")
    return { agent: ["run_code"], project: ["read"], task: ["read"] };
  // Same permission the comment routes require to create or delete.
  if (action.type === "comment.create") return { task: ["update"] };
  if (action.type === "task.create")
    return { task: action.userId ? ["create", "assign"] : ["create"] };
  return {
    task: Object.keys(action.patch).some((key) => key !== "userId")
      ? action.patch.userId !== undefined
        ? ["update", "assign"]
        : ["update"]
      : ["assign"],
  };
}
