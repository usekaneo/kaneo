import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function reorderProjects(
  workspaceId: string,
  projects: Array<{ id: string; position: number }>,
) {
  const ids = projects.map((project) => project.id);

  // Verify ownership of the whole batch before writing anything, so a smuggled
  // foreign id cannot leave the workspace half-renumbered.
  const owned = ids.length
    ? await db
        .select({ id: projectTable.id })
        .from(projectTable)
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            inArray(projectTable.id, ids),
          ),
        )
    : [];

  const ownedIds = new Set(owned.map((project) => project.id));
  const foreignId = ids.find((id) => !ownedIds.has(id));

  if (foreignId) {
    throw new HTTPException(400, {
      message: `Project ${foreignId} does not belong to this workspace`,
    });
  }

  return db.transaction(async (tx) => {
    for (const project of projects) {
      await tx
        .update(projectTable)
        .set({ position: project.position })
        .where(
          and(
            eq(projectTable.id, project.id),
            eq(projectTable.workspaceId, workspaceId),
          ),
        );
    }

    return tx.query.projectTable.findMany({
      where: eq(projectTable.workspaceId, workspaceId),
      orderBy: [asc(projectTable.position), asc(projectTable.createdAt)],
    });
  });
}

export default reorderProjects;
