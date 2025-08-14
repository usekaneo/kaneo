import { eq, and, or } from "drizzle-orm";
import db from "../../database";
import {
  taskLinkTable,
  taskTable,
  type TaskLinkType,
} from "../../database/schema";
import { HTTPException } from "hono/http-exception";
import { publishEvent } from "../../events";
/**
 * Create a link between two tasks.
 * Supports directional (e.g., 'blocks', 'parent') and undirected ('relates_to', 'duplicates') types.
 * Duplicate links are rejected. If type is undirected, the pair order is normalised.
 */
async function createTaskLink({
  taskId,
  targetTaskId,
  type,
  userEmail,
}: {
  taskId: string;
  targetTaskId: string;
  type: TaskLinkType;
  userEmail: string;
}) {
  // verify both tasks exist
  const tasks = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(or(eq(taskTable.id, taskId), eq(taskTable.id, targetTaskId)));

  if (tasks.length < 2) {
    throw new HTTPException(404, { message: "One or both tasks not found" });
  }

  const undirected = ["relates_to", "duplicates"].includes(type);
  const from = undirected && taskId > targetTaskId ? targetTaskId : taskId;
  const to = undirected && taskId > targetTaskId ? taskId : targetTaskId;

  // check for duplicate link
  const existing = await db
    .select({ id: taskLinkTable.id })
    .from(taskLinkTable)
    .where(
      and(
        eq(taskLinkTable.fromTaskId, from),
        eq(taskLinkTable.toTaskId, to),
        eq(taskLinkTable.type, type),
      ),
    );

  if (existing.length) {
    throw new HTTPException(409, { message: "Link already exists" });
  }

  const [inserted] = await db
    .insert(taskLinkTable)
    .values({
      fromTaskId: from,
      toTaskId: to,
      type,
      createdBy: userEmail,
    })
    .returning();

  await publishEvent("taskLink.created", {
    link: inserted,
    createdBy: userEmail,
  });

  return inserted;
}

export default createTaskLink;
