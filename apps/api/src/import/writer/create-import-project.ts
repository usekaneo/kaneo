import { eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { insertProject } from "../../project/controllers/insert-project";
import { createWithUniqueKey } from "./create-with-unique-key";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CreatedProject = NonNullable<Awaited<ReturnType<typeof insertProject>>>;

export type ImportProjectInput = {
  workspaceId: string;
  name: string;
  userId: string;
  preferredKey?: string;
};

export async function createImportProject<T>(
  { workspaceId, name, userId, preferredKey }: ImportProjectInput,
  fill: (tx: Transaction, project: CreatedProject) => Promise<T>,
): Promise<T> {
  const existing = await db
    .select({ slug: projectTable.slug })
    .from(projectTable)
    .where(eq(projectTable.workspaceId, workspaceId));

  return createWithUniqueKey(
    name,
    existing.map((row) => row.slug),
    (slug) =>
      db.transaction(async (tx) => {
        const project = await insertProject(tx, {
          workspaceId,
          name,
          icon: "Layout",
          slug,
          userId,
        });
        if (!project) throw new Error("Failed to create the imported project");
        return fill(tx, project);
      }),
    { preferredKey },
  );
}
