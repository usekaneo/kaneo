import { HTTPException } from "hono/http-exception";

// RFC 0001 WP2/WP3/WP4: shared insert-conflict mapping for repository
// bindings. A violation of the per-project unique constraint becomes a 409
// with the machine-readable code `repository_already_linked`; any other
// constraint re-throws unchanged so a genuine failure stays a 500 (RFC risk
// table, row 1).

export const INTEGRATION_PROJECT_TYPE_REPO_UNIQUE =
  "integration_project_type_repo_unique";

type PostgresUniqueViolation = Error & {
  code?: string;
  constraint?: string;
};

export function isDatabaseUniqueViolation(
  error: unknown,
): error is PostgresUniqueViolation {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PostgresUniqueViolation).code === "23505"
  );
}

/**
 * Map a caught insert error on the integration table to its API response.
 * `projectId` and `type` are echoed back so clients can render context.
 */
export function mapIntegrationUniqueViolation(
  error: unknown,
  context?: { projectId?: string; type?: string },
): never {
  if (!isDatabaseUniqueViolation(error)) {
    throw error;
  }
  if (error.constraint !== INTEGRATION_PROJECT_TYPE_REPO_UNIQUE) {
    throw error;
  }
  throw new HTTPException(409, {
    message: "Repository is already linked to this project",
    res: Response.json(
      {
        code: "repository_already_linked",
        message: "Repository is already linked to this project",
        ...(context?.projectId !== undefined
          ? { projectId: context.projectId }
          : {}),
        ...(context?.type !== undefined ? { type: context.type } : {}),
      },
      { status: 409 },
    ),
  });
}
