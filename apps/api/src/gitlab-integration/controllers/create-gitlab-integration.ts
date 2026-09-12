import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import {
  type GitlabConfig,
  type GitlabTokenType,
  getDefaultGitlabConfig,
  normalizeGitlabBaseUrl,
  normalizeProjectPath,
  validateGitlabConfig,
} from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

async function createGitlabIntegration({
  projectId,
  baseUrl,
  accessToken,
  tokenType,
  projectPath,
}: {
  projectId: string;
  baseUrl: string;
  accessToken: string | undefined;
  tokenType: GitlabTokenType;
  projectPath: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const normalizedBase = normalizeGitlabBaseUrl(baseUrl);
  const normalizedPath = normalizeProjectPath(projectPath);

  const existingIntegration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  let resolvedToken = accessToken?.trim() ?? "";
  if (!resolvedToken && existingIntegration) {
    try {
      const previous = JSON.parse(existingIntegration.config) as GitlabConfig;
      resolvedToken = previous.accessToken;
    } catch (error) {
      console.warn("Failed to parse existing GitLab integration config", {
        integrationId: existingIntegration.id,
        error,
      });
    }
  }

  if (!resolvedToken) {
    throw new HTTPException(400, {
      message: "Access token is required",
    });
  }

  try {
    await verifyGitlabToken(normalizedBase, resolvedToken, tokenType);

    const client = createGitlabClient({
      baseUrl: normalizedBase,
      accessToken: resolvedToken,
      tokenType,
    });
    await client.getProject(normalizedPath);
  } catch (error) {
    if (error instanceof GitlabApiError) {
      throw new HTTPException((error.status || 400) as ContentfulStatusCode, {
        message: error.message,
      });
    }
    throw error;
  }

  const allGitlab = await db.query.integrationTable.findMany({
    where: eq(integrationTable.type, "gitlab"),
  });

  for (const integration of allGitlab) {
    if (integration.projectId === projectId || !integration.isActive) {
      continue;
    }
    try {
      const config = JSON.parse(integration.config) as {
        baseUrl?: string;
        projectPath?: string;
      };
      if (
        normalizeGitlabBaseUrl(config.baseUrl ?? "") === normalizedBase &&
        normalizeProjectPath(config.projectPath ?? "") === normalizedPath
      ) {
        throw new HTTPException(409, {
          message: `Project ${normalizedPath} on this GitLab instance is already linked to another project`,
        });
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.warn(
        "Skipping invalid GitLab integration config during conflict check",
        {
          integrationId: integration.id,
          error,
        },
      );
    }
  }

  let webhookSecret = randomBytes(24).toString("hex");
  if (existingIntegration) {
    try {
      const previousConfig = JSON.parse(
        existingIntegration.config,
      ) as GitlabConfig;
      webhookSecret = previousConfig.webhookSecret ?? webhookSecret;
    } catch (error) {
      console.warn(
        "Failed to parse existing GitLab config for webhook secret",
        {
          integrationId: existingIntegration.id,
          error,
        },
      );
    }
  }

  const config = getDefaultGitlabConfig(
    normalizedBase,
    resolvedToken,
    tokenType,
    normalizedPath,
    webhookSecret,
  );

  const validation = await validateGitlabConfig(config);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: validation.errors?.join(", ") ?? "Invalid config",
    });
  }

  if (existingIntegration) {
    const [updated] = await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(config),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, "gitlab"),
        ),
      )
      .returning();

    if (!updated) {
      throw new HTTPException(500, {
        message: "Failed to update GitLab integration",
      });
    }

    return {
      id: updated.id,
      projectId: updated.projectId,
      baseUrl: normalizedBase,
      projectPath: normalizedPath,
      tokenType,
      webhookSecret,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  const [newIntegration] = await db
    .insert(integrationTable)
    .values({
      projectId,
      type: "gitlab",
      config: JSON.stringify(config),
      isActive: true,
    })
    .returning();

  if (!newIntegration) {
    throw new HTTPException(500, {
      message: "Failed to create GitLab integration",
    });
  }

  return {
    id: newIntegration.id,
    projectId: newIntegration.projectId,
    baseUrl: normalizedBase,
    projectPath: normalizedPath,
    tokenType,
    webhookSecret,
    isActive: newIntegration.isActive,
    createdAt: newIntegration.createdAt,
    updatedAt: newIntegration.updatedAt,
  };
}

export default createGitlabIntegration;
