import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { giteaIntegrationTable } from "../../database/schema";

async function deleteGiteaIntegration(projectId: string) {
  const integration = await db.query.giteaIntegrationTable.findFirst({
    where: eq(giteaIntegrationTable.projectId, projectId),
  });

  if (!integration) {
    throw new HTTPException(404, { message: "Gitea integration not found" });
  }

  await db
    .update(giteaIntegrationTable)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(giteaIntegrationTable.projectId, projectId));

  return { success: true, message: "Gitea integration deleted successfully" };
}

export default deleteGiteaIntegration;
