import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { mapIntegrationUniqueViolation } from "../../integrations/map-unique-violation";
import { defaultGitHubConfig } from "../../plugins/github/config";
import {
  assertRepositoryBindingQuota,
  withRepositoryBindingQuotaLock,
} from "../../plan-limits/repository-binding-quota";
import { verifyRepositoryOwner } from "./verify-repository-owner";

// RFC 0001 WP2: one integration row per GitHub repository. The
// disconnect-before-switching rule is gone: linking another repository
// inserts a new binding instead of mutating the single existing row. Per
// governing decision D1 there is deliberately no cross-project check; the
// per-project unique constraint decides same-project duplicates (409).
//
// Re-linking a repository this project already binds (either under the
// numeric key of an already-verified row or under the legacy owner/name key
// of a migration row) reconciles that row in place: the verified binding
// merges into its config, the repository identity is re-keyed numerically,
// and the row reactivates. Existing issue links, settings, and the
// integration id are preserved instead of stranding them on a replaced row.

/** Repository identity key: `github:<numeric repository id>` (verified bindings). */
export function githubRepositoryKey(repositoryId: number): string {
  return `github:${repositoryId}`;
}

/**
 * Legacy pre-re-keying key form: `github:<owner>/<name>` lowercased. Rows
 * written by the startup migration keep this key until they are re-verified
 * in place by {@link createGithubIntegration}.
 */
export function legacyGithubRepositoryKey(
  repositoryOwner: string,
  repositoryName: string,
): string {
  return `github:${repositoryOwner}/${repositoryName}`.toLowerCase();
}

/** Parse a stored config, tolerating legacy rows with invalid JSON. */
function parseStoredConfig(raw: string): Record<string, unknown> {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  return parsed;
}

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

  // WP10: the reconcile lookup, the quota guard, and the write run in one
  // transaction under the project's advisory lock, so two concurrent creates
  // or reactivations for the same project cannot both pass the quota check.
  // Repository verification above stays outside the transaction because it
  // talks to GitHub over HTTP.
  return withRepositoryBindingQuotaLock(projectId, async (tx) => {
    // Re-verification path (findings: legacy rows could never become verified,
    // and relinking an already-migrated repository would insert a second row):
    // a same-project row for this repository may already exist, either
    // already re-keyed numerically or still under the legacy owner/name key
    // written by the startup migration. Reconcile it in place.
    const numericKey = githubRepositoryKey(binding.repositoryId);
    const legacyKey = legacyGithubRepositoryKey(
      binding.repositoryOwner,
      binding.repositoryName,
    );
    const existingRow = await tx.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "github"),
        inArray(integrationTable.repositoryKey, [numericKey, legacyKey]),
      ),
    });

    if (existingRow) {
      // WP10: reactivating a deactivated row re-enters the binding count, so
      // the quota guard runs before the update writes isActive=true.
      if (!existingRow.isActive) {
        await assertRepositoryBindingQuota(projectId, project.workspaceId, tx);
      }

      const previousConfig = parseStoredConfig(existingRow.config);
      // Verified values win over any stale values in the old config; user
      // settings (branch pattern, workflow transitions, comment behavior)
      // survive the merge.
      const mergedConfig = {
        ...defaultGitHubConfig,
        ...previousConfig,
        ...binding,
      };

      try {
        const [reconciled] = await tx
          .update(integrationTable)
          .set({
            config: JSON.stringify(mergedConfig),
            repositoryKey: githubRepositoryKey(binding.repositoryId),
            repositoryOwner: binding.repositoryOwner,
            repositoryName: binding.repositoryName,
            repositoryId: binding.repositoryId,
            isActive: true,
            updatedAt: new Date(),
          })
          // Optimistic config check, mirroring the update route: refresh if
          // the row changed between the read and the write.
          .where(
            and(
              eq(integrationTable.id, existingRow.id),
              eq(integrationTable.config, existingRow.config),
            ),
          )
          .returning();

        if (!reconciled) {
          throw new HTTPException(409, {
            message: "GitHub integration changed; refresh before relinking",
          });
        }

        return {
          id: reconciled.id,
          projectId: reconciled.projectId,
          repositoryOwner: binding.repositoryOwner,
          repositoryName: binding.repositoryName,
          installationId,
          requiresVerification: false,
          isActive: reconciled.isActive,
          createdAt: reconciled.createdAt,
          updatedAt: reconciled.updatedAt,
        };
      } catch (error) {
        mapIntegrationUniqueViolation(error, { projectId, type: "github" });
      }
    }

    // WP10: enforce the per-project repository binding quota after repository
    // verification and before the insert. 402 propagates unchanged.
    await assertRepositoryBindingQuota(projectId, project.workspaceId, tx);

    const config = { ...defaultGitHubConfig, ...binding };

    try {
      const [newIntegration] = await tx
        .insert(integrationTable)
        .values({
          projectId,
          type: "github",
          config: JSON.stringify(config),
          repositoryKey: githubRepositoryKey(binding.repositoryId),
          repositoryOwner: binding.repositoryOwner,
          repositoryName: binding.repositoryName,
          repositoryId: binding.repositoryId,
          isActive: true,
        })
        .returning();

      if (!newIntegration) {
        throw new HTTPException(500, {
          message: "Failed to create GitHub integration",
        });
      }

      return {
        id: newIntegration.id,
        projectId: newIntegration.projectId,
        repositoryOwner: binding.repositoryOwner,
        repositoryName: binding.repositoryName,
        installationId,
        requiresVerification: false,
        isActive: newIntegration.isActive,
        createdAt: newIntegration.createdAt,
        updatedAt: newIntegration.updatedAt,
      };
    } catch (error) {
      mapIntegrationUniqueViolation(error, { projectId, type: "github" });
    }
  });
}

export default createGithubIntegration;
