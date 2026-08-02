import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { defaultGitHubConfig } from "../../plugins/github/config";
import {
  getGithubApp,
  getGithubOctokit,
} from "../../plugins/github/utils/github-app";

async function createGithubIntegration({
  projectId,
  repositoryOwner,
  repositoryName,
  userId,
}: {
  projectId: string;
  repositoryOwner: string;
  repositoryName: string;
  userId?: string;
}) {
  const octokit = await getGithubOctokit(userId);
  const githubApp = getGithubApp();

  if (!octokit && !githubApp) {
    throw new HTTPException(400, {
      message:
        "GitHub not connected. Please link your GitHub account or configure GitHub App.",
    });
  }

  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const allGitHubIntegrations = await db.query.integrationTable.findMany({
    where: eq(integrationTable.type, "github"),
  });

  for (const integration of allGitHubIntegrations) {
    if (integration.projectId === projectId) {
      continue;
    }

    try {
      const config = JSON.parse(integration.config);
      if (
        config.repositoryOwner === repositoryOwner &&
        config.repositoryName === repositoryName
      ) {
        throw new HTTPException(409, {
          message: `Repository ${repositoryOwner}/${repositoryName} is already linked to another project`,
        });
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
    }
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

  const existingIntegration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "github"),
    ),
  });

  const config = {
    repositoryOwner,
    repositoryName,
    installationId,
    ...defaultGitHubConfig,
  };

  if (existingIntegration) {
    const [updatedIntegration] = await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(config),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, "github"),
        ),
      )
      .returning();

    return {
      id: updatedIntegration?.id,
      projectId: updatedIntegration?.projectId,
      repositoryOwner,
      repositoryName,
      installationId,
      isActive: updatedIntegration?.isActive,
      createdAt: updatedIntegration?.createdAt,
      updatedAt: updatedIntegration?.updatedAt,
    };
  }

  const [newIntegration] = await db
    .insert(integrationTable)
    .values({
      projectId,
      type: "github",
      config: JSON.stringify(config),
      isActive: true,
    })
    .returning();

  return {
    id: newIntegration?.id,
    projectId: newIntegration?.projectId,
    repositoryOwner,
    repositoryName,
    installationId,
    isActive: newIntegration?.isActive,
    createdAt: newIntegration?.createdAt,
    updatedAt: newIntegration?.updatedAt,
  };
}

export default createGithubIntegration;
