import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { taskTable } from "../../database/schema";
import { getProjectWorkspaceId } from "../../utils/assert-assignable-user";
import { assertContactInWorkspace } from "../assert-contact-in-workspace";
import { withLockedTask } from "./with-locked-task";

// No realtime event: the editing client refreshes its own cache and other
// clients pick the link up on their next fetch.
async function updateTaskContact({
  id,
  contactId,
}: {
  id: string;
  contactId: string | null;
}) {
  const { after } = await withLockedTask(id, async (tx, existing) => {
    if (existing.contactId === contactId) return existing;

    if (contactId) {
      await assertContactInWorkspace(
        contactId,
        await getProjectWorkspaceId(existing.projectId, tx),
        tx,
      );
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
  return after;
}

export default updateTaskContact;
