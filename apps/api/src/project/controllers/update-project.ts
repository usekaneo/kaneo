import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { findProjectKeyConflict, projectKeyTakenMessage } from "../project-key";

async function updateProject(
  id: string,
  name: string,
  icon: string,
  slug: string,
  description: string,
  isPublic: boolean,
  workspaceId: string,
  canShare: boolean,
) {
  const [existingProject] = await db
    .select()
    .from(projectTable)
    .where(
      and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
    );

  if (!existingProject) {
    throw new HTTPException(404, {
      message:
        "Project doesn't exist or doesn't belong to the specified workspace",
    });
  }

  if (isPublic !== existingProject.isPublic && !canShare) {
    throw new HTTPException(403, {
      message:
        "Changing project visibility requires the project:share permission",
    });
  }

  const keyChanged = slug.toLowerCase() !== existingProject.slug.toLowerCase();

  return db.transaction(async (tx) => {
    if (keyChanged) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
      );
      const keyConflict = await findProjectKeyConflict(
        tx,
        workspaceId,
        slug,
        id,
      );
      if (keyConflict) {
        throw new HTTPException(409, {
          message: projectKeyTakenMessage(slug, keyConflict.name),
        });
      }
    }

    const [updatedProject] = await tx
      .update(projectTable)
      .set({
        name,
        icon,
        slug,
        description,
        isPublic,
      })
      .where(
        and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
      )
      .returning();

    if (!updatedProject) {
      throw new HTTPException(404, {
        message:
          "Project doesn't exist or doesn't belong to the specified workspace",
      });
    }

    return updatedProject;
  });
}

export default updateProject;
