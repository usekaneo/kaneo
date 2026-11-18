import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { mapIntegrationUniqueViolation } from "../../integrations/map-unique-violation";
import { defaultGitHubConfig } from "../../plugins/github/config";
import { assertRepositoryBindingQuota } from "../../plan-limits/repository-binding-quota";
import { verifyRepositoryOwner } from "./verify-repository-owner";

// RFC 0001 WP2: one integration row per GitHub repository. The
// disconnect-before-switching rule is gone: linking another repository
// inserts a new binding instead of mutating the single existing row. Per
// governing decision D1 there is deliberately no cross-project check; the
// per-project unique constraint decides same-project duplicates (409).

/** Repository identity key: `github:<numeric repository id>` (verified bindings). */
export function githubRepositoryKey(repositoryId: number): string {
  return `github:${repositoryId}`;
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

  // WP10: enforce the per-project repository binding quota after repository
  // verification and before the insert. 402 propagates unchanged.
  await assertRepositoryBindingQuota(projectId, project.workspaceId);

  const config = { ...defaultGitHubConfig, ...binding };

  try {
    const [newIntegration] = await db
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
}

export default createGithubIntegration;
