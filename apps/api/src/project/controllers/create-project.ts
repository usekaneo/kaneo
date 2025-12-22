import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function createProject(
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
) {
  const [existingProjectWithSlug] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        eq(projectTable.slug, slug),
      ),
    )
    .limit(1);

  if (existingProjectWithSlug) {
    throw new HTTPException(409, {
      message: "Project key is already in use in this workspace",
    });
  }

  const [createdProject] = await db
    .insert(projectTable)
    .values({
      workspaceId,
      name,
      icon,
      slug,
    })
    .returning();

  return createdProject;
}

export default createProject;
