import { or, eq } from "drizzle-orm";
import db from "../../database";
import { taskLinkTable } from "../../database/schema";

/**
 * Retrieve all links for a specific task.
 * Returns each link with direction relative to `taskId`.
 */
async function getTaskLinks(taskId: string) {
  const rows = await db
    .select()
    .from(taskLinkTable)
    .where(
      or(
        eq(taskLinkTable.fromTaskId, taskId),
        eq(taskLinkTable.toTaskId, taskId),
      ),
    );

  return rows.map((row) => {
    const { id, fromTaskId, toTaskId, type, createdAt, createdBy } = row;
    let direction: "out" | "in" | "undirected";

    if (type === "relates_to" || type === "duplicates") {
      direction = "undirected";
    } else if (fromTaskId === taskId) {
      direction = "out";
    } else {
      direction = "in";
    }
    return {
      id,
      fromTaskId,
      toTaskId,
      type,
      createdAt,
      createdBy,
      direction,
    };
  });
}

export default getTaskLinks;
