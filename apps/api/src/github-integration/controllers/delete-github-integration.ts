import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";

async function deleteGithubIntegration(projectId: string) {
  const existingIntegration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "github"),
    ),
  });

  if (!existingIntegration) {
    throw new HTTPException(404, { message: "GitHub integration not found" });
  }

  await db
    .delete(integrationTable)
    .where(
      and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "github"),
      ),
    );

  return { success: true, message: "GitHub integration deleted" };
}

export default deleteGithubIntegration;
