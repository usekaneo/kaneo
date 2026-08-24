import { HTTPException } from "hono/http-exception";
import { normalizeGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

// GitLab access levels: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner.
// Developer is the minimum level that can create/edit issues.
const DEVELOPER_ACCESS_LEVEL = 30;

async function verifyGitlabAccess({
  baseUrl,
  accessToken,
  repositoryPath,
}: {
  baseUrl: string;
  accessToken: string;
  repositoryPath: string;
}) {
  try {
    const normalized = normalizeGitlabBaseUrl(baseUrl);
    try {
      await verifyGitlabToken(normalized, accessToken);
    } catch (error) {
      // A 404 from /user means the URL does not point at a GitLab instance
      // (or the token endpoint is misrouted), not a project lookup failure.
      if (error instanceof GitlabApiError && error.status === 404) {
        return {
          isInstalled: false,
          hasRequiredPermissions: false,
          repositoryExists: false,
          repositoryPrivate: null,
          missingPermissions: [] as string[],
          message: "The URL does not point to a GitLab instance.",
          failureReason: "not_a_gitlab_instance",
        };
      }
      throw error;
    }

    const client = createGitlabClient({
      baseUrl: normalized,
      accessToken,
    });

    const repo = await client.getProject(repositoryPath);

    const accessLevel = Math.max(
      repo.permissions?.project_access?.access_level ?? 0,
      repo.permissions?.group_access?.access_level ?? 0,
    );
    const hasIssuesWrite = accessLevel >= DEVELOPER_ACCESS_LEVEL;

    return {
      isInstalled: true,
      hasRequiredPermissions: hasIssuesWrite,
      repositoryExists: true,
      repositoryPrivate: repo.visibility !== "public",
      missingPermissions: hasIssuesWrite ? [] : ["issues (write)"],
      message: hasIssuesWrite
        ? "Token can access the project."
        : "Token may not have sufficient permissions to manage issues.",
      failureReason: null,
    };
  } catch (error) {
    const err = error as { status?: number; message?: string };

    if (error instanceof GitlabApiError) {
      if (error.kind === "REDIRECT") {
        return {
          isInstalled: false,
          hasRequiredPermissions: false,
          repositoryExists: false,
          repositoryPrivate: null,
          missingPermissions: [] as string[],
          message: `The GitLab URL redirected (HTTP ${error.status}). This usually means the server forces HTTPS. Please use the final URL directly.`,
          failureReason: "redirected",
        };
      }

      if (error.kind === "INVALID_JSON") {
        return {
          isInstalled: false,
          hasRequiredPermissions: false,
          repositoryExists: false,
          repositoryPrivate: null,
          missingPermissions: [] as string[],
          message: "The URL does not point to a GitLab instance.",
          failureReason: "not_a_gitlab_instance",
        };
      }
    }

    if (err.status === 404) {
      return {
        isInstalled: false,
        hasRequiredPermissions: false,
        repositoryExists: false,
        repositoryPrivate: null,
        missingPermissions: [] as string[],
        message: "Project not found or not accessible with this token.",
        failureReason: "repository_not_found",
      };
    }

    if (err.status === 401) {
      throw new HTTPException(401, {
        message: "Invalid GitLab token or unauthorized.",
      });
    }

    throw new HTTPException(500, {
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify GitLab access",
    });
  }
}

export default verifyGitlabAccess;
