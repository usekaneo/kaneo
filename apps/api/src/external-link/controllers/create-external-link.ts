import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  externalLinkTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

async function createExternalLink({
  taskId,
  url,
  title,
  userId,
}: {
  taskId: string;
  url: string;
  title?: string;
  userId: string;
}) {
  const [link] = await db
    .insert(externalLinkTable)
    .values({
      taskId,
      integrationId: null,
      resourceType: "url",
      externalId: url,
      url,
      title: title ?? null,
    })
    .returning();

  if (!link) {
    throw new HTTPException(500, {
      message: "Failed to create external link",
    });
  }

  const [task] = await db
    .select({
      projectId: taskTable.projectId,
      title: taskTable.title,
      status: taskTable.status,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await publishEvent("task.updated", {
    taskId,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
    userId,
  });

  return link;
}

export default createExternalLink;
