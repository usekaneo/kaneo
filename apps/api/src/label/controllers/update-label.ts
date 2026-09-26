import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable } from "../../database/schema";

async function updateLabel(id: string, name: string, color: string) {
  return db.transaction(async (tx) => {
    const label = await tx.query.labelTable.findFirst({
      where: (label, { eq }) => eq(label.id, id),
    });

    if (!label) {
      throw new HTTPException(404, {
        message: "Label not found",
      });
    }

    if (label.deletionStartedAt)
      throw new HTTPException(409, {
        message: "This label is being deleted; resume its deletion instead",
      });

    const [updatedLabel] = await tx
      .update(labelTable)
      .set({ name, color })
      .where(and(eq(labelTable.id, id), isNull(labelTable.deletionStartedAt)))
      .returning();

    if (!updatedLabel)
      throw new HTTPException(409, { message: "This label is being deleted" });

    // If this is a workspace-level label, cascade the changes to all
    // task-level copies so existing label assignments reflect the new color/name
    if (!label.taskId && label.workspaceId) {
      await tx
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
  });
}

export default updateLabel;
