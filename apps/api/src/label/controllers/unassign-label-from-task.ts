import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable } from "../../database/schema";
import { removeLabelFromGitHub } from "../../plugins/github/utils/sync-label-to-github";

async function unassignLabelFromTask(id: string) {
  const label = await db.query.labelTable.findFirst({
    where: (label, { eq }) => eq(label.id, id),
  });

  if (!label) {
    throw new HTTPException(404, {
      message: "Label not found",
    });
  }

  const [updatedLabel] = await db
    .update(labelTable)
    .set({ taskId: null })
    .where(eq(labelTable.id, id))
    .returning();

  if (!updatedLabel) {
    throw new HTTPException(500, {
      message: "Failed to detach label from task",
    });
  }

  if (label.taskId) {
    removeLabelFromGitHub(label.taskId, label.name).catch((error) => {
      console.error("Failed to remove label from GitHub:", error);
    });
  }

  return updatedLabel;
}

export default unassignLabelFromTask;
