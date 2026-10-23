import createLabel from "./create-label";
import { getProjectDefaultLabels } from "./get-project-default-labels";

// Runs after the task exists, so a label that fails to attach never undoes
// the create; it is logged and the rest still apply.
export async function applyProjectDefaultLabels(task: {
  id: string;
  projectId: string;
  workspaceId: string;
  userId: string;
}) {
  for (const label of await getProjectDefaultLabels(task.projectId)) {
    try {
      await createLabel(
        label.name,
        label.color,
        task.id,
        task.workspaceId,
        task.userId,
      );
    } catch (error) {
      console.error("Failed to apply a project default label:", error);
    }
  }
}
