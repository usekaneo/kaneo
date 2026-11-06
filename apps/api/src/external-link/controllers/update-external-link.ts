import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { MANUAL_RESOURCE_TYPES } from "../manual-resource-types";

export default async function updateExternalLink({
  taskId,
  id,
  title,
  metadata,
  userId,
}: {
  taskId: string;
  id: string;
  title?: string;
  metadata?: { state: "open" | "closed"; merged: boolean; draft: boolean };
  userId: string;
}) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
    columns: { projectId: true, title: true, status: true },
  });
  if (!task) throw new HTTPException(404, { message: "Task not found" });

  const manualLink = and(
    eq(externalLinkTable.id, id),
    eq(externalLinkTable.taskId, taskId),
    isNull(externalLinkTable.integrationId),
    inArray(externalLinkTable.resourceType, MANUAL_RESOURCE_TYPES),
  );
  const existing = await db.query.externalLinkTable.findFirst({
    where: manualLink,
    columns: { resourceType: true },
  });
  if (!existing)
    throw new HTTPException(404, { message: "Manual resource link not found" });
  if (metadata && existing.resourceType !== "pull_request") {
    throw new HTTPException(400, {
      message: "Metadata is only accepted for pull request links",
    });
  }

  const [updated] = await db
    .update(externalLinkTable)
    .set({
      ...(title !== undefined ? { title } : {}),
      ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
    })
    .where(manualLink)
    .returning();
  if (!updated)
    throw new HTTPException(404, { message: "Manual resource link not found" });

  await publishEvent("task.updated", { taskId, ...task, userId });
  return updated;
}
