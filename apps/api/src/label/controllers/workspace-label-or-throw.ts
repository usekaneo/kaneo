import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable } from "../../database/schema";

// Pins and project defaults name a workspace label, never a task's copy.
export async function workspaceLabelOrThrow(id: string) {
  const label = await db.query.labelTable.findFirst({
    where: eq(labelTable.id, id),
  });
  if (!label) throw new HTTPException(404, { message: "Label not found" });
  if (label.taskId || !label.workspaceId)
    throw new HTTPException(400, {
      message: "Only workspace labels can be used here",
    });
  if (label.deletionStartedAt)
    throw new HTTPException(409, { message: "This label is being deleted" });
  return label;
}
