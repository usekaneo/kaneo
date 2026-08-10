import { HTTPException } from "hono/http-exception";
import { normalizeGiteaBaseUrl } from "../../plugins/gitea/config";
import {
  createGiteaClient,
  GiteaApiError,
  verifyGiteaToken,
} from "../../plugins/gitea/utils/gitea-api";

async function verifyGiteaAccess({
  baseUrl,
  accessToken,
  repositoryOwner,
  repositoryName,
}: {
  baseUrl: string;
  accessToken: string;
  repositoryOwner: string;
  repositoryName: string;
}) {
  try {
    const normalized = normalizeGiteaBaseUrl(baseUrl);
    try {
      await verifyGiteaToken(normalized, accessToken);
    } catch (error) {
      // A 404 from /user means the URL does not point at a Gitea instance
      // (or the token endpoint is misrouted), not a repository lookup
      // failure. Treat it like any other non-Gitea-instance signal.
      if (error instanceof GiteaApiError && error.status === 404) {
        return {
          isInstalled: false,
          hasRequiredPermissions: false,
          repositoryExists: false,
          repositoryPrivate: null,
          missingPermissions: [] as string[],
          message: "The URL does not point to a Gitea instance.",
          failureReason: "not_a_gitea_instance",
        };
      }
      throw error;
    }

    const client = createGiteaClient({
      baseUrl: normalized,
      accessToken,
    });

    const repo = await client.getRepo(repositoryOwner, repositoryName);

    const perms = repo.permissions;
    const hasIssuesWrite = perms?.admin === true || perms?.push === true;

    return {
      isInstalled: true,
      hasRequiredPermissions: Boolean(hasIssuesWrite),
      repositoryExists: true,
      repositoryPrivate: repo.private,
      missingPermissions: hasIssuesWrite ? [] : ["issues (write)"],
      message: hasIssuesWrite
        ? "Token can access the repository."
        : "Token may not have sufficient permissions to manage issues.",
      failureReason: null,
    };
  } catch (error) {
    const err = error as { status?: number; message?: string };

    if (error instanceof GiteaApiError) {
      if (error.kind === "REDIRECT") {
        return {
          isInstalled: false,
          hasRequiredPermissions: false,
          repositoryExists: false,
          repositoryPrivate: null,
          missingPermissions: [] as string[],
          message: `The Gitea URL redirected (HTTP ${error.status}). This usually means the server forces HTTPS. Please use the final URL directly.`,
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
          message: "The URL does not point to a Gitea instance.",
          failureReason: "not_a_gitea_instance",
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
        message: "Repository not found or not accessible with this token.",
        failureReason: "repository_not_found",
      };
    }

    if (err.status === 401) {
      throw new HTTPException(401, {
        message: "Invalid Gitea token or unauthorized.",
      });
    }

    throw new HTTPException(500, {
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify Gitea access",
    });
  }
}

export default verifyGiteaAccess;
