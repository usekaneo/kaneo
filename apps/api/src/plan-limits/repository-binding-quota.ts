import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { integrationTable } from "../database/schema";
import { publishEvent } from "../events";
import type { IntegrationDatabase } from "../plugins/github/services/integration-task-scope";
import { resolveRepositoryBindingLimits } from "./resolve-limits";

// RFC 0001 WP10: enforcement of the per-project repository binding quota.
// Unit: active repository bindings per project across the three git providers
// (github, gitea, gitlab). Cross-project sharing (D1) does not affect the
// count: a binding is counted once, in the project it belongs to. Deactivated
// bindings do not count; reactivation is re-checked by the update controllers.
// Non-git integrations are not counted.

export const REPOSITORY_BINDING_TYPES = ["github", "gitea", "gitlab"] as const;

export interface RepositoryBindingUsage {
  used: number;
  /** null = unlimited */
  limit: number | null;
}

export class BindingLimitExceededError extends HTTPException {
  readonly used: number;
  readonly limit: number;

  constructor(used: number, limit: number, message: string) {
    // 402 distinguishes a plan-capacity problem from an authorization
    // failure (403) and from a same-project duplicate (409).
    super(402, {
      res: Response.json(
        {
          code: "binding_limit_exceeded",
          message,
          used,
          limit,
        },
        { status: 402 },
      ),
      message,
    });
    this.used = used;
    this.limit = limit;
  }
}

export async function countActiveRepositoryBindings(
  projectId: string,
  database: IntegrationDatabase = db,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(integrationTable)
    .where(
      and(
        eq(integrationTable.projectId, projectId),
        inArray(integrationTable.type, [...REPOSITORY_BINDING_TYPES]),
        eq(integrationTable.isActive, true),
      ),
    );
  return row?.count ?? 0;
}

export async function getRepositoryBindingUsage(
  projectId: string,
  workspaceId: string,
  database: IntegrationDatabase = db,
): Promise<RepositoryBindingUsage> {
  const { maxPerProject } = await resolveRepositoryBindingLimits(
    workspaceId,
    database,
  );
  const used = await countActiveRepositoryBindings(projectId, database);
  return { used, limit: maxPerProject };
}

// Called by the create controllers (WP2-WP4) after repository verification and
// before the insert, and by the update controllers when isActive transitions
// false to true. The count and the write must share one transaction guarded
// by the project's per-project advisory lock
// ({@link withRepositoryBindingQuotaLock}), so two concurrent creates or
// reactivations on the same project cannot both pass the count check.
export async function assertRepositoryBindingQuota(
  projectId: string,
  workspaceId: string,
  database: IntegrationDatabase = db,
): Promise<void> {
  const { maxPerProject } = await resolveRepositoryBindingLimits(
    workspaceId,
    database,
  );
  if (maxPerProject === null) return;
  const used = await countActiveRepositoryBindings(projectId, database);
  if (used >= maxPerProject) {
    // Conversion signal for the cloud billing stack; published exactly once
    // per refused create, reusing the existing event mechanism.
    await publishEvent("integration.binding_quota_exceeded", {
      workspaceId,
      projectId,
      used,
      limit: maxPerProject,
    });
    throw new BindingLimitExceededError(
      used,
      maxPerProject,
      `Repository binding limit reached: this project already uses ${used} of ${maxPerProject} repository bindings included in the current plan.`,
    );
  }
}

/** The transaction handle {@link withRepositoryBindingQuotaLock} passes on. */
export type RepositoryBindingQuotaTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/**
 * Serialize a quota check together with the binding write that follows it,
 * per project.
 *
 * The count-then-write pair in a create or reactivation used to be two
 * separate statements, so two concurrent requests could both pass the count
 * check and transiently overshoot the plan limit. Running both inside one
 * transaction under the project's advisory lock closes the race: whoever
 * holds the lock sees every binding committed before it.
 *
 * The lock is taken with pg_advisory_xact_lock, so it is released
 * automatically when the transaction ends, including on rollback. Provider
 * verification (which talks to GitHub, Gitea, or GitLab over HTTP) must stay
 * outside the callback.
 */
export async function withRepositoryBindingQuotaLock<T>(
  projectId: string,
  work: (tx: RepositoryBindingQuotaTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`
        SELECT pg_advisory_xact_lock(
          hashtext('repo-binding-quota'),
          hashtext(${projectId})
        )
      `,
    );
    return work(tx);
  });
}
