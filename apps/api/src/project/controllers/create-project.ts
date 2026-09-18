import { eq, max, sql } from "drizzle-orm";
import db from "../../database";
import { columnTable, projectTable } from "../../database/schema";

export const DEFAULT_PROJECT_COLUMNS = [
  { name: "To Do", slug: "to-do", position: 0, isFinal: false },
  { name: "In Progress", slug: "in-progress", position: 1, isFinal: false },
  { name: "In Review", slug: "in-review", position: 2, isFinal: false },
  { name: "Done", slug: "done", position: 3, isFinal: true },
] as const;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function insertProject(
  tx: Tx,
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
) {
  // Serialize ordering writes per workspace: without this, two concurrent
  // creates can read the same max(position) and land on the same slot, and a
  // create can interleave with a reorder's renumber. `reorderProjects` takes
  // the same lock with the same key.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
  );

  // New projects go to the bottom of the workspace's ordering.
  const [{ maxPosition } = { maxPosition: null }] = await tx
    .select({ maxPosition: max(projectTable.position) })
    .from(projectTable)
    .where(eq(projectTable.workspaceId, workspaceId));

  const [createdProject] = await tx
    .insert(projectTable)
    .values({
      workspaceId,
      name,
      icon,
      slug,
      position: maxPosition === null ? 0 : maxPosition + 1,
    })
    .returning();

  if (createdProject) {
    for (const col of DEFAULT_PROJECT_COLUMNS) {
      await tx.insert(columnTable).values({
        projectId: createdProject.id,
        name: col.name,
        slug: col.slug,
        position: col.position,
        isFinal: col.isFinal,
      });
    }
  }

  return createdProject;
}

async function createProject(
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
) {
  return db.transaction((tx) =>
    insertProject(tx, workspaceId, name, icon, slug),
  );
}

export default createProject;
