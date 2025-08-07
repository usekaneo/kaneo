import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { giteaIntegrationTable, projectTable } from "../../database/schema";

async function createGiteaIntegration({
  projectId,
  giteaUrl,
  repositoryOwner,
  repositoryName,
  accessToken,
  webhookSecret,
}: {
  projectId: string;
  giteaUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  accessToken?: string;
  webhookSecret?: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const existingIntegration = await db.query.giteaIntegrationTable.findFirst({
    where: eq(giteaIntegrationTable.projectId, projectId),
  });

  if (existingIntegration) {
    const [updatedIntegration] = await db
      .update(giteaIntegrationTable)
      .set({
        giteaUrl,
        repositoryOwner,
        repositoryName,
        accessToken,
        webhookSecret,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(giteaIntegrationTable.projectId, projectId))
      .returning();

    return updatedIntegration;
  }

  const [newIntegration] = await db
    .insert(giteaIntegrationTable)
    .values({
      projectId,
      giteaUrl,
      repositoryOwner,
      repositoryName,
      accessToken,
      webhookSecret,
      isActive: true,
    })
    .returning();

  return newIntegration;
}

export default createGiteaIntegration;
