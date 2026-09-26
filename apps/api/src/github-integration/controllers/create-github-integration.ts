import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import {
  defaultGitHubConfig,
  githubConfigSchema,
} from "../../plugins/github/config";
import { verifyRepositoryOwner } from "./verify-repository-owner";

async function createGithubIntegration({
  userId,
  projectId,
  repositoryOwner,
  repositoryName,
}: {
  userId: string;
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

  const binding = await verifyRepositoryOwner(
    userId,
    repositoryOwner,
    repositoryName,
  );
  const { installationId } = binding;

  const existingIntegration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "github"),
    ),
  });

  let previousConfig = {};
  if (existingIntegration) {
    let previous: unknown;
    try {
      previous = JSON.parse(existingIntegration.config);
    } catch {
      previous = null;
    }
    const parsed = v.safeParse(githubConfigSchema, previous);
    const sameRepository =
      parsed.success &&
      (parsed.output.repositoryId !== undefined
        ? parsed.output.repositoryId === binding.repositoryId
        : parsed.output.repositoryOwner.toLowerCase() ===
            binding.repositoryOwner.toLowerCase() &&
          parsed.output.repositoryName.toLowerCase() ===
            binding.repositoryName.toLowerCase());
    if (!sameRepository) {
      // External issue/PR numbers are scoped to a repository. Reusing this
      // integration ID would reinterpret its existing links in another repo.
      throw new HTTPException(409, {
        message:
          "Disconnect the current GitHub integration before connecting a different repository",
      });
    }
    if (parsed.success) previousConfig = parsed.output;
  }
  const config = { ...defaultGitHubConfig, ...previousConfig, ...binding };

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
          eq(integrationTable.id, existingIntegration.id),
          eq(integrationTable.config, existingIntegration.config),
        ),
      )
      .returning();

    if (!updatedIntegration)
      throw new HTTPException(409, {
        message: "GitHub integration changed; refresh before reconnecting",
      });

    return {
      id: updatedIntegration.id,
      projectId: updatedIntegration?.projectId,
      repositoryOwner: binding.repositoryOwner,
      repositoryName: binding.repositoryName,
      installationId,
      requiresVerification: false,
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
    repositoryOwner: binding.repositoryOwner,
    repositoryName: binding.repositoryName,
    installationId,
    requiresVerification: false,
    isActive: newIntegration?.isActive,
    createdAt: newIntegration?.createdAt,
    updatedAt: newIntegration?.updatedAt,
  };
}

export default createGithubIntegration;
