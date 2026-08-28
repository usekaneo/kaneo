import { HTTPException } from "hono/http-exception";
import { normalizeGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  hasRequiredAccess,
  REQUIRED_ACCESS_LABEL,
} from "../../plugins/gitlab/utils/access-level";
import {
  createGitlabClient,
  GitlabApiError,
  type GitlabTokenType,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

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

  let normalized: string;
  try {
    // z.url() lets through a query, a fragment, and non-http schemes that
    // normalization rejects; that is bad input, not a server fault.
    normalized = normalizeGitlabBaseUrl(baseUrl);
  } catch (error) {
    return {
      ...notAGitlabInstance,
      message:
        error instanceof Error
          ? error.message
          : "The URL is not a valid GitLab base URL.",
    };
  }

  try {
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

    const hasRequiredPermissions = hasRequiredAccess(project);

    return {
      isInstalled: true,
      hasRequiredPermissions,
      projectExists: true,
      projectPrivate: project.visibility !== "public",
      missingPermissions: hasRequiredPermissions ? [] : [REQUIRED_ACCESS_LABEL],
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
