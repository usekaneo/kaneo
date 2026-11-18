import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import {
  findProjectKeyConflict,
  isSameProjectKey,
  projectKeyTakenMessage,
} from "../project-key";

async function updateProject(
  id: string,
  name: string,
  icon: string,
  slug: string,
  description: string,
  isPublic: boolean,
  workspaceId: string,
  canShare: boolean,
  defaultSprintLengthDays?: number,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
    );

    const [existingProject] = await tx
      .select()
      .from(projectTable)
      .where(
        and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
      )
      .for("update");

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

    if (!isSameProjectKey(slug, existingProject.slug)) {
      const keyConflict = await findProjectKeyConflict(tx, workspaceId, slug, {
        excludeProjectId: id,
      });
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
        ...(defaultSprintLengthDays !== undefined && {
          defaultSprintLengthDays,
        }),
      })
      .where(eq(projectTable.id, id))
      .returning();

    return updatedProject;
  });
}

export default updateProject;
