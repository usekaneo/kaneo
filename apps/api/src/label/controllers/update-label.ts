import { and, eq, isNotNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable } from "../../database/schema";

async function updateLabel(id: string, name: string, color: string) {
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
    .set({ name, color })
    .where(eq(labelTable.id, id))
    .returning();

  // If this is a workspace-level label, cascade the changes to all
  // task-level copies so existing label assignments reflect the new color/name
  if (!label.taskId && label.workspaceId) {
    await db
      .update(labelTable)
      .set({ name, color })
      .where(
        and(
          eq(labelTable.workspaceId, label.workspaceId),
          eq(labelTable.name, label.name),
          isNotNull(labelTable.taskId),
        ),
      );
  }

  return updatedLabel;
}

export default updateLabel;
