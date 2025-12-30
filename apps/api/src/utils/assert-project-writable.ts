import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable } from "../database/schema";

export async function assertProjectWritable(projectId: string): Promise<void> {
  const [project] = await db
    .select({ archivedAt: projectTable.archivedAt })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  if (project.archivedAt) {
    throw new HTTPException(403, {
      message: "Project is archived and read-only",
    });
  }
}
