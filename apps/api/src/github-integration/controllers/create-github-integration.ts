import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { githubIntegrationTable, projectTable } from "../../database/schema";
import githubApp from "../utils/create-github-app";

async function createGithubIntegration({
  projectId,
  repositoryOwner,
  repositoryName,
}: {
  projectId: string;
  repositoryOwner: string;
  repositoryName: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  let installationId: number | null = null;
  try {
    const { data: installation } =
      await githubApp.octokit.rest.apps.getRepoInstallation({
        owner: repositoryOwner,
        repo: repositoryName,
      });
    installationId = installation.id;
  } catch (error) {
    console.warn("Could not get installation ID for repository:", error);
  }

  const existingIntegration = await db.query.githubIntegrationTable.findFirst({
    where: eq(githubIntegrationTable.projectId, projectId),
  });

  if (existingIntegration) {
    const [updatedIntegration] = await db
      .update(githubIntegrationTable)
      .set({
        repositoryOwner,
        repositoryName,
        installationId,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(githubIntegrationTable.projectId, projectId))
      .returning();

    return updatedIntegration;
  }

  const [newIntegration] = await db
    .insert(githubIntegrationTable)
    .values({
      projectId,
      repositoryOwner,
      repositoryName,
      installationId,
      isActive: true,
    })
    .returning();

  return newIntegration;
}

export default createGithubIntegration;
