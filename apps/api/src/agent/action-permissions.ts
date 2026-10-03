import type { AgentAction } from "./types";

export function actionPermissions(action: AgentAction) {
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
