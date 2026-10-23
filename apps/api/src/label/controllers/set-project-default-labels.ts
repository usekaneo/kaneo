import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  labelTable,
  projectDefaultLabelTable,
  projectTable,
} from "../../database/schema";
import { getProjectDefaultLabels } from "./get-project-default-labels";

export async function setProjectDefaultLabels(
  projectId: string,
  labelIds: string[],
) {
  const ids = [...new Set(labelIds)];
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
    columns: { workspaceId: true },
  });
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const labels = ids.length
    ? await db
        .select({ id: labelTable.id })
        .from(labelTable)
        .where(
          and(
            inArray(labelTable.id, ids),
            eq(labelTable.workspaceId, project.workspaceId),
            isNull(labelTable.taskId),
            isNull(labelTable.deletionStartedAt),
          ),
        )
    : [];
  if (labels.length !== ids.length)
    throw new HTTPException(400, {
      message: "Default labels must be workspace labels of this project",
    });

  await db.transaction(async (tx) => {
    await tx
      .delete(projectDefaultLabelTable)
      .where(eq(projectDefaultLabelTable.projectId, projectId));
    if (ids.length)
      await tx
        .insert(projectDefaultLabelTable)
        .values(ids.map((labelId) => ({ projectId, labelId })));
  });

  return getProjectDefaultLabels(projectId);
}
