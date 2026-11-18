import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { mapIntegrationUniqueViolation } from "../../integrations/map-unique-violation";
import {
  assertRepositoryBindingQuota,
  withRepositoryBindingQuotaLock,
} from "../../plan-limits/repository-binding-quota";
import {
  type GiteaConfig,
  getDefaultGiteaConfig,
  normalizeGiteaBaseUrl,
  validateGiteaConfig,
} from "../../plugins/gitea/config";
import {
  createGiteaClient,
  GiteaApiError,
  verifyGiteaToken,
} from "../../plugins/gitea/utils/gitea-api";

import { resolveVerificationToken } from "./resolve-verification-token";

// RFC 0001 WP3: one integration row per Gitea repository. Cross-project
// duplicates are valid rows per governing decision D1; same-project
// duplicates are decided by the per-project unique constraint
// (integration_project_type_repo_unique).
//
// Re-linking a repository this project already binds reconciles that row in
// place instead of inserting a second one: the row is snapshotted before the
// verification round trip, and after verification the verified destination is
// merged into the prior config (preserving sync rules, user settings, and
// the webhook secret), the repository identity columns are re-keyed, and the
// row is reactivated. A config that changed during verification (for example
// sync rules saved while the token was being verified) is not silently
// overwritten: the guarded update matches no row and the request fails with
// 409. Existing issue links and the integration id survive a re-verification.

/**
 * Repository identity key: `gitea:<normalized baseUrl>/<owner>/<name>`,
 * lowercased owner and name (RFC 0001 section 4.1).
 */
export function giteaRepositoryKey(
  baseUrl: string,
  repositoryOwner: string,
  repositoryName: string,
): string {
  return `gitea:${baseUrl}/${repositoryOwner.toLowerCase()}/${repositoryName.toLowerCase()}`;
}

/** Parse a stored config, tolerating legacy rows with invalid JSON. */
function parseStoredConfig(raw: string): Partial<GiteaConfig> {
  try {
    return JSON.parse(raw) as Partial<GiteaConfig>;
  } catch {
    return {};
  }
}

/** Normalize a stored base URL, treating an invalid legacy value as absent. */
function storedGiteaBaseUrl(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  try {
    return normalizeGiteaBaseUrl(raw);
  } catch {
    return null;
  }
}

type ReconcilableRow = {
  id: string;
  config: string;
  repositoryKey: string | null;
  isActive: boolean | null;
};

/**
 * Pick the same-project row that a re-link reconciles in place. A row keyed
 * with the repository identity key wins; otherwise legacy rows written
 * before the `repositoryKey` column keep their destination inside config
 * JSON only and are matched in memory.
 */
function findReconcilableGiteaRow<T extends ReconcilableRow>(
  rows: T[],
  repositoryKey: string,
  baseUrl: string,
  repositoryOwner: string,
  repositoryName: string,
): T | null {
  for (const row of rows) {
    if (row.repositoryKey === repositoryKey) return row;
  }
  for (const row of rows) {
    const stored = parseStoredConfig(row.config);
    if (
      storedGiteaBaseUrl(stored.baseUrl) === baseUrl &&
      typeof stored.repositoryOwner === "string" &&
      typeof stored.repositoryName === "string" &&
      stored.repositoryOwner.toLowerCase() === repositoryOwner.toLowerCase() &&
      stored.repositoryName.toLowerCase() === repositoryName.toLowerCase()
    ) {
      return row;
    }
  }
  return null;
}

async function createGiteaIntegration({
  projectId,
  baseUrl,
  accessToken,
  repositoryOwner,
  repositoryName,
}: {
  projectId: string;
  baseUrl: string;
  accessToken: string | undefined;
  repositoryOwner: string;
  repositoryName: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const normalizedBase = normalizeGiteaBaseUrl(baseUrl);

  const resolvedToken = await resolveVerificationToken({
    projectId,
    baseUrl: normalizedBase,
    accessToken,
  });

  // Snapshot the reconcilable row before the verification round trip so a
  // concurrent change to its config (for example sync rules saved while the
  // token was being verified) is detected by the guarded update below and
  // rejected with 409 instead of being silently overwritten.
  const sameProjectGitea = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitea"),
    ),
  });
  const repositoryKey = giteaRepositoryKey(
    normalizedBase,
    repositoryOwner,
    repositoryName,
  );
  const snapshot = findReconcilableGiteaRow(
    sameProjectGitea,
    repositoryKey,
    normalizedBase,
    repositoryOwner,
    repositoryName,
  );

  try {
    await verifyGiteaToken(normalizedBase, resolvedToken);

    const client = createGiteaClient({
      baseUrl: normalizedBase,
      accessToken: resolvedToken,
    });
    await client.getRepo(repositoryOwner, repositoryName);
  } catch (error) {
    if (error instanceof GiteaApiError) {
      throw new HTTPException((error.status || 400) as ContentfulStatusCode, {
        message: error.message,
      });
    }
    throw error;
  }

  const webhookSecret = randomBytes(24).toString("hex");

  const config: GiteaConfig = getDefaultGiteaConfig(
    normalizedBase,
    resolvedToken,
    repositoryOwner,
    repositoryName,
    webhookSecret,
  );

  const validation = await validateGiteaConfig(config);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: validation.errors?.join(", ") ?? "Invalid config",
    });
  }

  // WP10: the quota guard and the write run in one transaction under the
  // project's advisory lock, so two concurrent creates or reactivations for
  // the same project cannot both pass the quota check. Token verification
  // and config validation above stay outside the transaction because they
  // talk to Gitea over HTTP.
  return withRepositoryBindingQuotaLock(projectId, async (tx) => {
    // Re-link path: the snapshot taken before verification reconciles in
    // place. A second row for this repository in this project cannot exist
    // (the unique constraint forbids it), so insert stays the only other
    // branch.
    if (snapshot) {
      // WP10: reactivating a deactivated row re-enters the binding count,
      // so the quota guard runs before the update writes isActive=true.
      if (!snapshot.isActive) {
        await assertRepositoryBindingQuota(projectId, project.workspaceId, tx);
      }

      // Verified values win over any stale values in the old config; user
      // settings (sync rules, workflow transitions, comment behavior) and
      // the prior webhook secret survive the merge, mirroring the update
      // route's reconnect semantics.
      const previousConfig = parseStoredConfig(snapshot.config);
      const mergedConfig = {
        ...getDefaultGiteaConfig(
          normalizedBase,
          resolvedToken,
          repositoryOwner,
          repositoryName,
          previousConfig.webhookSecret ?? webhookSecret,
        ),
        ...previousConfig,
        baseUrl: normalizedBase,
        accessToken: resolvedToken,
        repositoryOwner,
        repositoryName,
        webhookSecret: previousConfig.webhookSecret ?? webhookSecret,
      };

      try {
        const [reconciled] = await tx
          .update(integrationTable)
          .set({
            config: JSON.stringify(mergedConfig),
            repositoryKey,
            repositoryOwner,
            repositoryName,
            baseUrl: normalizedBase,
            isActive: true,
            updatedAt: new Date(),
          })
          // Optimistic config check against the pre-verification snapshot:
          // if the row changed while the token was being verified, the
          // update matches no row and the caller must refresh.
          .where(
            and(
              eq(integrationTable.id, snapshot.id),
              eq(integrationTable.config, snapshot.config),
            ),
          )
          .returning();

        if (!reconciled) {
          throw new HTTPException(409, {
            message: "Gitea integration changed; refresh before reconnecting",
          });
        }

        return {
          id: reconciled.id,
          projectId: reconciled.projectId,
          baseUrl: normalizedBase,
          repositoryOwner,
          repositoryName,
          webhookSecret: mergedConfig.webhookSecret,
          isActive: reconciled.isActive,
          createdAt: reconciled.createdAt,
          updatedAt: reconciled.updatedAt,
        };
      } catch (error) {
        mapIntegrationUniqueViolation(error, { projectId, type: "gitea" });
      }
    }

    // WP10: enforce the per-project repository binding quota before the
    // insert. 402 propagates unchanged.
    await assertRepositoryBindingQuota(projectId, project.workspaceId, tx);

    try {
      const [newIntegration] = await tx
        .insert(integrationTable)
        .values({
          projectId,
          type: "gitea",
          config: JSON.stringify(config),
          repositoryKey,
          repositoryOwner,
          repositoryName,
          baseUrl: normalizedBase,
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
        isActive: newIntegration.isActive,
        createdAt: newIntegration.createdAt,
        updatedAt: newIntegration.updatedAt,
      };
    } catch (error) {
      mapIntegrationUniqueViolation(error, { projectId, type: "gitea" });
    }
  });
}

export default createGiteaIntegration;
