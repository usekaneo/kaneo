import { HTTPException } from "hono/http-exception";
import type { GitlabTokenType } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  type GitlabProject,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";
import {
  parseGitlabBaseUrl,
  parseGitlabProjectPath,
} from "../utils/normalize-input";

// Developer is the lowest role that can create the priority/status labels.
const REQUIRED_ACCESS_LEVEL = 30;

function highestAccessLevel(project: GitlabProject): number {
  const permissions = project.permissions;
  return Math.max(
    permissions?.project_access?.access_level ?? 0,
    permissions?.group_access?.access_level ?? 0,
  );
}

function failure(
  message: string,
  failureReason: "not_a_gitlab_instance" | "redirected" | "project_not_found",
) {
  return {
    isInstalled: false,
    hasRequiredPermissions: false,
    projectExists: false,
    projectVisibility: null,
    missingPermissions: [] as string[],
    message,
    failureReason,
  };
}

async function verifyGitlabAccess({
  baseUrl,
  accessToken,
  tokenType,
  projectPath,
}: {
  baseUrl: string;
  accessToken: string;
  tokenType: GitlabTokenType;
  projectPath: string;
}) {
  const normalized = parseGitlabBaseUrl(baseUrl);
  const normalizedPath = parseGitlabProjectPath(projectPath);

  try {
    try {
      await verifyGitlabToken(normalized, accessToken, tokenType);
    } catch (error) {
      // 404 from /user: the URL is not a GitLab instance.
      if (error instanceof GitlabApiError && error.status === 404) {
        return failure(
          "The URL does not point to a GitLab instance.",
          "not_a_gitlab_instance",
        );
      }
      throw error;
    }

    const client = createGitlabClient({
      baseUrl: normalized,
      accessToken,
      tokenType,
    });

    const project = await client.getProject(normalizedPath);

    // Group and instance tokens have no project access level.
    const accessLevel = highestAccessLevel(project);
    const hasRequiredPermissions =
      accessLevel === 0 || accessLevel >= REQUIRED_ACCESS_LEVEL;

    return {
      isInstalled: true,
      hasRequiredPermissions,
      projectExists: true,
      projectVisibility: project.visibility,
      missingPermissions: hasRequiredPermissions ? [] : ["Developer"],
      message: hasRequiredPermissions
        ? "Token can access the project."
        : "Token may not have sufficient permissions to manage issues and labels.",
      failureReason: null,
    };
  } catch (error) {
    if (error instanceof GitlabApiError) {
      if (error.kind === "REDIRECT") {
        return failure(
          `The GitLab URL redirected (HTTP ${error.status}). This usually means the server forces HTTPS. Please use the final URL directly.`,
          "redirected",
        );
      }

      if (error.kind === "INVALID_JSON") {
        return failure(
          "The URL does not point to a GitLab instance.",
          "not_a_gitlab_instance",
        );
      }

      if (error.status === 404) {
        return failure(
          "Project not found or not accessible with this token.",
          "project_not_found",
        );
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
