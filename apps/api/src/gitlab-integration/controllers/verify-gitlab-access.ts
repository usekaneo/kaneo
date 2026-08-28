import { HTTPException } from "hono/http-exception";
import { normalizeGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  type GitlabTokenType,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

// GitLab role levels: Guest 10, Reporter 20, Developer 30, Maintainer 40,
// Owner 50. Managing project labels needs Developer.
const REQUIRED_ACCESS_LEVEL = 30;

function highestAccessLevel(permissions: {
  project_access?: { access_level?: number } | null;
  group_access?: { access_level?: number } | null;
}): number {
  return Math.max(
    permissions.project_access?.access_level ?? 0,
    permissions.group_access?.access_level ?? 0,
  );
}

async function verifyGitlabAccess({
  baseUrl,
  accessToken,
  tokenType = "pat",
  namespace,
  projectPath,
}: {
  baseUrl: string;
  accessToken: string;
  tokenType?: GitlabTokenType;
  namespace: string;
  projectPath: string;
}) {
  const notAGitlabInstance = {
    isInstalled: false,
    hasRequiredPermissions: false,
    projectExists: false,
    projectPrivate: null,
    missingPermissions: [] as string[],
    message: "The URL does not point to a GitLab instance.",
    failureReason: "not_a_gitlab_instance" as const,
  };

  try {
    const normalized = normalizeGitlabBaseUrl(baseUrl);
    try {
      await verifyGitlabToken(normalized, accessToken, tokenType);
    } catch (error) {
      // A 404 from /user means the URL does not point at a GitLab instance
      // (or the API is misrouted), not a project lookup failure.
      if (error instanceof GitlabApiError && error.status === 404) {
        return notAGitlabInstance;
      }
      throw error;
    }

    const client = createGitlabClient({
      baseUrl: normalized,
      accessToken,
      tokenType,
      namespace,
      projectPath,
    });

    const project = await client.getProject();

    const accessLevel = highestAccessLevel(project.permissions ?? {});
    const hasRequiredPermissions = accessLevel >= REQUIRED_ACCESS_LEVEL;

    return {
      isInstalled: true,
      hasRequiredPermissions,
      projectExists: true,
      projectPrivate: project.visibility !== "public",
      missingPermissions: hasRequiredPermissions
        ? []
        : ["Developer role or higher"],
      message: hasRequiredPermissions
        ? "Token can access the project."
        : "Token may not have sufficient permissions to manage issues and labels.",
      failureReason: null,
    };
  } catch (error) {
    if (error instanceof GitlabApiError) {
      if (error.kind === "REDIRECT") {
        return {
          isInstalled: false,
          hasRequiredPermissions: false,
          projectExists: false,
          projectPrivate: null,
          missingPermissions: [] as string[],
          message: `The GitLab URL redirected (HTTP ${error.status}). This usually means the server forces HTTPS. Please use the final URL directly.`,
          failureReason: "redirected" as const,
        };
      }

      if (error.kind === "INVALID_JSON") {
        return notAGitlabInstance;
      }

      if (error.status === 404) {
        return {
          isInstalled: true,
          hasRequiredPermissions: false,
          projectExists: false,
          projectPrivate: null,
          missingPermissions: [] as string[],
          message: "Project not found or not accessible with this token.",
          failureReason: "project_not_found" as const,
        };
      }

      if (error.status === 401 || error.status === 403) {
        throw new HTTPException(401, {
          message: "Invalid GitLab token or unauthorized.",
        });
      }
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
