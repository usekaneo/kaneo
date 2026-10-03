import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import {
  type GiteaConfig,
  type GiteaIssueSyncMode,
  getGiteaIssueSyncMode,
  getDefaultGiteaConfig,
  normalizeGiteaBaseUrl,
  validateGiteaConfig,
  giteaConfigSchema,
} from "../../plugins/gitea/config";
import { retireGiteaIssueEdits } from "../../plugins/gitea/services/retire-issue-edits";

import { resolveVerificationContext } from "./resolve-verification-context";
import verifyGiteaAccess from "./verify-gitea-access";

async function createGiteaIntegration({
  projectId,
  baseUrl,
  accessToken,
  repositoryOwner,
  repositoryName,
  issueSyncMode,
}: {
  projectId: string;
  baseUrl: string;
  accessToken: string | undefined;
  repositoryOwner: string;
  repositoryName: string;
  issueSyncMode?: GiteaIssueSyncMode;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const normalizedBase = normalizeGiteaBaseUrl(baseUrl);

  const existingIntegration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitea"),
    ),
  });

  const { accessToken: resolvedToken, issueSyncMode: targetMode } =
    await resolveVerificationContext({
      projectId,
      baseUrl: normalizedBase,
      accessToken,
      issueSyncMode,
    });

  const allGitea = await db.query.integrationTable.findMany({
    where: eq(integrationTable.type, "gitea"),
  });

  for (const integration of allGitea) {
    if (integration.projectId === projectId) {
      continue;
    }
    if (!integration.isActive) {
      continue;
    }
    try {
      const cfg = JSON.parse(integration.config) as {
        baseUrl?: string;
        repositoryOwner?: string;
        repositoryName?: string;
      };
      if (
        normalizeGiteaBaseUrl(cfg.baseUrl ?? "") === normalizedBase &&
        cfg.repositoryOwner === repositoryOwner &&
        cfg.repositoryName === repositoryName
      ) {
        throw new HTTPException(409, {
          message: `Repository ${repositoryOwner}/${repositoryName} on this Gitea instance is already linked to another project`,
        });
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.warn(
        "Skipping invalid Gitea integration config during conflict check",
        {
          integrationId: integration.id,
          error,
        },
      );
    }
  }

  let webhookSecret = randomBytes(24).toString("hex");
  let previousConfig: GiteaConfig | undefined;
  let previousBaseUrl: string | undefined;
  if (existingIntegration) {
    try {
      const savedConfig: unknown = JSON.parse(existingIntegration.config);
      previousConfig = v.parse(giteaConfigSchema, savedConfig);
      webhookSecret = previousConfig.webhookSecret ?? webhookSecret;
      previousBaseUrl = normalizeGiteaBaseUrl(previousConfig.baseUrl);
    } catch (error) {
      console.warn("Failed to parse existing Gitea config for webhook secret", {
        integrationId: existingIntegration.id,
        error,
      });
    }
  }

  const config: GiteaConfig = {
    ...getDefaultGiteaConfig(
      normalizedBase,
      resolvedToken,
      repositoryOwner,
      repositoryName,
      webhookSecret,
    ),
    ...previousConfig,
    baseUrl: normalizedBase,
    accessToken: resolvedToken,
    repositoryOwner,
    repositoryName,
    webhookSecret,
    issueSyncMode: targetMode,
  };


  const validation = await validateGiteaConfig(config);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: validation.errors?.join(", ") ?? "Invalid config",
    });
  }
  const sameTarget =
    previousConfig &&
    previousBaseUrl === normalizedBase &&
    previousConfig.repositoryOwner === repositoryOwner &&
    previousConfig.repositoryName === repositoryName;
  const enablingSync =
    targetMode === "sync" &&
    (!sameTarget ||
      getGiteaIssueSyncMode(previousConfig ?? {}) !== "sync" ||
      previousConfig?.accessToken !== resolvedToken);
  const verification = await verifyGiteaAccess({
    ...config,
    issueSyncMode: enablingSync ? "sync" : "ingest-only",
  });
  if (
    !verification.isInstalled ||
    !verification.repositoryExists ||
    !verification.hasRequiredPermissions
  ) {
    throw new HTTPException(400, { message: verification.message });
  }

  if (existingIntegration) {
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(integrationTable)
        .where(eq(integrationTable.id, existingIntegration.id))
        .for("update");
      if (
        !current ||
        current.config !== existingIntegration.config ||
        current.isActive !== existingIntegration.isActive ||
        current.updatedAt.getTime() !== existingIntegration.updatedAt.getTime()
      ) {
        throw new HTTPException(409, {
          message: "Integration changed. Reload and try again.",
        });
      }
      const [saved] = await tx
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
      if (
        saved && targetMode !== "sync" &&
        (!sameTarget || getGiteaIssueSyncMode(previousConfig ?? {}) !== targetMode)
      ) {
        await retireGiteaIssueEdits(saved.id, tx, targetMode);
      }
      return saved;
    });

    if (!updated) {
      throw new HTTPException(409, {
        message: "Gitea integration changed; refresh before reconnecting",
      });
    }

    return {
      id: updated.id,
      projectId: updated.projectId,
      baseUrl: normalizedBase,
      repositoryOwner,
      repositoryName,
      webhookSecret,
      issueSyncMode: getGiteaIssueSyncMode(config),
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  const [newIntegration] = await db
    .insert(integrationTable)
    .values({
      projectId,
      type: "gitea",
      config: JSON.stringify(config),
      isActive: true,
    })
    .returning();

  if (!newIntegration) {
    throw new HTTPException(500, {
      message: "Failed to create Gitea integration",
    });
  }

  return {
    id: newIntegration.id,
    projectId: newIntegration.projectId,
    baseUrl: normalizedBase,
    repositoryOwner,
    repositoryName,
    webhookSecret,
    issueSyncMode: getGiteaIssueSyncMode(config),
    isActive: newIntegration.isActive,
    createdAt: newIntegration.createdAt,
    updatedAt: newIntegration.updatedAt,
  };
}

export default createGiteaIntegration;
