import { and, eq, ne } from "drizzle-orm";
import type db from "../database";
import { projectTable } from "../database/schema";

export function isSameProjectKey(a: string, b: string) {
  return (
    a.normalize("NFKC").toLowerCase() === b.normalize("NFKC").toLowerCase()
  );
}

export async function findProjectKeyConflict(
  database: Pick<typeof db, "select">,
  workspaceId: string,
  key: string,
  excludeProjectId?: string,
) {
  const projects = await database
    .select({ name: projectTable.name, slug: projectTable.slug })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        excludeProjectId ? ne(projectTable.id, excludeProjectId) : undefined,
      ),
    );

  return projects.find((project) => isSameProjectKey(project.slug, key));
}

export function projectKeyTakenMessage(key: string, projectName: string) {
  return `This workspace already has a project using the key "${key}" (${projectName}). Choose a different key.`;
}
