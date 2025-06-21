import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { githubIntegrationTable } from "../../database/schema";

async function getGithubIntegration(projectId: string) {
  const integration = await db.query.githubIntegrationTable.findFirst({
    where: eq(githubIntegrationTable.projectId, projectId),
  });

  if (!integration) {
    throw new HTTPException(404, {
      message: "GitHub integration not found",
    });
  }

  return integration;
}

export default getGithubIntegration;
