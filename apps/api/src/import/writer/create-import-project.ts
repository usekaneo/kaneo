import { eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";
import createProject from "../../project/controllers/create-project";
import { createWithUniqueKey } from "./create-with-unique-key";

export async function createImportProject(
  workspaceId: string,
  name: string,
  userId: string,
  preferredKey?: string,
) {
  const existing = await db
    .select({ slug: projectTable.slug })
    .from(projectTable)
    .where(eq(projectTable.workspaceId, workspaceId));

  const project = await createWithUniqueKey(
    name,
    existing.map((row) => row.slug),
    (key) => createProject(workspaceId, name, "Layout", key, userId),
    { preferredKey },
  );
  if (!project) throw new Error("Failed to create the imported project");
  return project;
}
