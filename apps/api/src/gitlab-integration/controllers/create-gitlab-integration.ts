import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import {
  type GitlabConfig,
  getDefaultGitlabConfig,
  normalizeGitlabBaseUrl,
  projectFullPath,
  validateGitlabConfig,
} from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  type GitlabTokenType,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

async function createGitlabIntegration({
  projectId,
  baseUrl,
  accessToken,
  tokenType,
  namespace,
  projectPath,
}: {
  projectId: string;
  baseUrl: string;
  accessToken: string | undefined;
  tokenType: GitlabTokenType | undefined;
  namespace: string;
  projectPath: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const normalizedBase = normalizeGitlabBaseUrl(baseUrl);

  const existingIntegration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  let previousConfig: GitlabConfig | null = null;
  if (existingIntegration) {
    try {
      previousConfig = JSON.parse(existingIntegration.config) as GitlabConfig;
    } catch (error) {
      console.warn("Failed to parse existing GitLab integration config", {
        integrationId: existingIntegration.id,
        error,
      });
    }
  }

  const resolvedToken =
    accessToken?.trim() || previousConfig?.accessToken || "";

  if (!resolvedToken) {
    throw new HTTPException(400, {
      message: "Access token is required",
    });
  }

  const resolvedTokenType: GitlabTokenType =
    tokenType ?? previousConfig?.tokenType ?? "pat";

  try {
    await verifyGitlabToken(normalizedBase, resolvedToken, resolvedTokenType);

    await createGitlabClient({
      baseUrl: normalizedBase,
      accessToken: resolvedToken,
      tokenType: resolvedTokenType,
      namespace,
      projectPath,
    }).getProject();
  } catch (error) {
    if (error instanceof GitlabApiError) {
      throw new HTTPException((error.status || 400) as ContentfulStatusCode, {
        message: error.message,
      });
    }
    throw error;
  }

  const fullPath = projectFullPath({ namespace, projectPath });

  const allGitlab = await db.query.integrationTable.findMany({
    where: eq(integrationTable.type, "gitlab"),
  });

  for (const integration of allGitlab) {
    if (integration.projectId === projectId || !integration.isActive) {
      continue;
    }
    try {
      const cfg = JSON.parse(integration.config) as Partial<GitlabConfig>;
      if (
        normalizeGitlabBaseUrl(cfg.baseUrl ?? "") === normalizedBase &&
        cfg.namespace &&
        cfg.projectPath &&
        projectFullPath({
          namespace: cfg.namespace,
          projectPath: cfg.projectPath,
        }) === fullPath
      ) {
        throw new HTTPException(409, {
          message: `Project ${fullPath} on this GitLab instance is already linked to another project`,
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

  const webhookSecret =
    previousConfig?.webhookSecret || randomBytes(24).toString("hex");

  const config: GitlabConfig = getDefaultGitlabConfig(
    normalizedBase,
    resolvedToken,
    resolvedTokenType,
    namespace,
    projectPath,
    webhookSecret,
  );

  const validation = await validateGitlabConfig(config);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: validation.errors?.join(", ") ?? "Invalid config",
    });
  }

  const [saved] = existingIntegration
    ? await db
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
        .returning()
    : await db
        .insert(integrationTable)
        .values({
          projectId,
          type: "gitlab",
          config: JSON.stringify(config),
          isActive: true,
        })
        .returning();

  if (!saved) {
    throw new HTTPException(500, {
      message: "Failed to save GitLab integration",
    });
  }

  return {
    id: saved.id,
    projectId: saved.projectId,
    baseUrl: normalizedBase,
    namespace,
    projectPath,
    webhookSecret,
    isActive: saved.isActive,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
}

export default createGitlabIntegration;
