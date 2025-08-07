import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { giteaIntegrationTable } from "../../database/schema";

async function getGiteaIntegration(projectId: string) {
  const integration = await db.query.giteaIntegrationTable.findFirst({
    where: eq(giteaIntegrationTable.projectId, projectId),
  });

  if (!integration) {
    throw new HTTPException(404, {
      message: "Gitea integration not found",
    });
  }

  return integration;
}

export default getGiteaIntegration;
