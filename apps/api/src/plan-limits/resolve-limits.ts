import { eq } from "drizzle-orm";
import db from "../database";
import { workspaceLimitTable } from "../database/schema";
import type { IntegrationDatabase } from "../plugins/github/services/integration-task-scope";

// RFC 0001 WP10: per-workspace repository binding limits resolved from the
// billing plan. Resolution order, first match wins:
//   1. workspace_limit.max_repositories_per_project (written by billing)
//   2. KANEO_MAX_REPOSITORIES_PER_PROJECT (instance default; unset or
//      non-positive means unlimited)
//   3. unlimited
// The billing integration point is the workspace_limit row: when a
// subscription changes plan, billing writes the new value and the very next
// create request enforces it. No API process coupling is required.

export interface RepositoryBindingLimits {
  /** null = unlimited */
  maxPerProject: number | null;
}

export function instanceDefaultMaxRepositoriesPerProject(): number | null {
  const raw = process.env.KANEO_MAX_REPOSITORIES_PER_PROJECT;
  if (!raw || !raw.trim()) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function resolveRepositoryBindingLimits(
  workspaceId: string,
  database: IntegrationDatabase = db,
): Promise<RepositoryBindingLimits> {
  const [row] = await database
    .select({
      maxRepositoriesPerProject: workspaceLimitTable.maxRepositoriesPerProject,
    })
    .from(workspaceLimitTable)
    .where(eq(workspaceLimitTable.workspaceId, workspaceId))
    .limit(1);
  if (row?.maxRepositoriesPerProject != null) {
    return { maxPerProject: row.maxRepositoriesPerProject };
  }
  return { maxPerProject: instanceDefaultMaxRepositoriesPerProject() };
}
