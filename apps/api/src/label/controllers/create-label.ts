import db from "../../database";
import { labelTable } from "../../database/schema";
import { syncLabelToGitHub } from "../../plugins/github/utils/sync-label-to-github";

async function createLabel(
  name: string,
  color: string,
  taskId: string | undefined,
  workspaceId: string,
) {
  const [label] = await db
    .insert(labelTable)
    .values({ name, color, taskId, workspaceId })
    .returning();

  if (taskId) {
    syncLabelToGitHub(taskId, name, color).catch((error) => {
      console.error("Failed to sync label to GitHub:", error);
    });
  }

  return label;
}

export default createLabel;
