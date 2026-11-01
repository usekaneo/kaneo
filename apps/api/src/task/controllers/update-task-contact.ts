import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { assertContactInWorkspace } from "../assert-contact-in-workspace";

// No realtime event: the editing client refreshes its own cache and other
// clients pick the link up on their next fetch.
async function updateTaskContact({
  id,
  contactId,
}: {
  id: string;
  contactId: string | null;
}) {
  const [current] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);
  if (!current) throw new HTTPException(404, { message: "Task not found" });

  return db.transaction(async (tx) => {
    // Project first, then the task: the order every other writer uses. A
    // project move holds the project lock while it clears contact links, so
    // checking the workspace here cannot race it.
    const [project] = await tx
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, current.projectId))
      .for("update");
    if (!project) throw new HTTPException(404, { message: "Task not found" });

    const [existing] = await tx
      .select()
      .from(taskTable)
      .where(eq(taskTable.id, id))
      .for("update");
    if (!existing) throw new HTTPException(404, { message: "Task not found" });
    if (existing.projectId !== current.projectId)
      throw new HTTPException(409, {
        message: "Task changed projects; retry",
      });
    if (existing.contactId === contactId) return existing;

    if (contactId) {
      await assertContactInWorkspace(contactId, project.workspaceId, tx);
    }

    const [updated] = await tx
      .update(taskTable)
      .set({ contactId })
      .where(eq(taskTable.id, id))
      .returning();
    if (!updated) {
      throw new HTTPException(500, { message: "Failed to update contact" });
    }
    return updated;
  });
}

export default updateTaskContact;
