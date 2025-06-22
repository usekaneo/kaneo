import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { githubIntegrationTable } from "../../database/schema";

async function deleteGithubIntegration(projectId: string) {
  const existingIntegration = await db.query.githubIntegrationTable.findFirst({
    where: eq(githubIntegrationTable.projectId, projectId),
  });

  if (!existingIntegration) {
    throw new HTTPException(404, { message: "GitHub integration not found" });
  }

  await db
    .delete(githubIntegrationTable)
    .where(eq(githubIntegrationTable.projectId, projectId));

  return { success: true, message: "GitHub integration deleted" };
}

export default deleteGithubIntegration;
