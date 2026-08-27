import { HTTPException } from "hono/http-exception";
import { Octokit } from "octokit";
import { getGithubApp } from "../../plugins/github/utils/github-app";

type VerificationResult = {
  isInstalled: boolean;
  installationId: number | null;
  repositoryExists: boolean | null;
  repositoryPrivate: boolean | null;
  permissions: Record<string, string> | null;
  hasRequiredPermissions: boolean;
  missingPermissions: string[];
  message: string;
  settingsUrl?: string;
  installationUrl?: string;
};

function isGithubNotFound(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return status === 404;
}

function appInstallUrl(): string | undefined {
  return process.env.GITHUB_APP_NAME
    ? `https://github.com/apps/${process.env.GITHUB_APP_NAME}`
    : undefined;
}

function newInstallUrl(targetId?: number): string | undefined {
  if (!process.env.GITHUB_APP_NAME) return undefined;
  const base = `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new`;
  return typeof targetId === "number" && Number.isFinite(targetId)
    ? `${base}/permissions?target_id=${targetId}`
    : `${base}/permissions`;
}

function settingsUrlFor(installationId: number): string {
  return `https://github.com/settings/installations/${installationId}`;
}

// PAT mode: confirm the token can see the repo and has write access (needed to
// create/close issues and sync labels). Repo-level `permissions.push`/`admin`
// stands in for the App's installation permission check.
async function verifyWithToken(
  repositoryOwner: string,
  repositoryName: string,
  accessToken: string,
): Promise<VerificationResult> {
  try {
    const octokit = new Octokit({ auth: accessToken });
    const { data } = await octokit.rest.repos.get({
      owner: repositoryOwner,
      repo: repositoryName,
    });

    const perms = data.permissions;
    const canWrite = Boolean(perms?.push || perms?.admin);
    const permissions = perms
      ? Object.fromEntries(
          Object.entries(perms).map(([key, value]) => [key, String(value)]),
        )
      : null;

    return {
      isInstalled: canWrite,
      installationId: null,
      repositoryExists: true,
      repositoryPrivate: data.private,
      permissions,
      hasRequiredPermissions: canWrite,
      missingPermissions: canWrite ? [] : ["contents/issues: write"],
      message: canWrite
        ? "Token has access to the repository with write permissions"
        : "Token can read the repository but lacks the write access needed to sync issues",
    };
  } catch (error) {
    if (isGithubNotFound(error)) {
      return {
        isInstalled: false,
        installationId: null,
        repositoryExists: false,
        repositoryPrivate: null,
        permissions: null,
        hasRequiredPermissions: false,
        missingPermissions: [],
        message:
          "Repository not found, or the token cannot access it. Check the token and its repository permissions.",
      };
    }

    throw new HTTPException(500, {
      message: `Failed to verify GitHub token: ${(error as Error).message || "Unknown error"}`,
    });
  }
}

async function verifyGithubInstallation({
  repositoryOwner,
  repositoryName,
  accessToken,
}: {
  repositoryOwner: string;
  repositoryName: string;
  accessToken?: string;
}): Promise<VerificationResult> {
  if (accessToken?.trim()) {
    return verifyWithToken(repositoryOwner, repositoryName, accessToken.trim());
  }

  const githubApp = getGithubApp();

  if (!githubApp) {
    throw new HTTPException(500, {
      message: "GitHub app not configured",
    });
  }

  let installation: { id: number; permissions?: Record<string, string> };
  try {
    const { data } = await githubApp.octokit.rest.apps.getRepoInstallation({
      owner: repositoryOwner,
      repo: repositoryName,
    });
    installation = data;
  } catch (error) {
    if (isGithubNotFound(error)) {
      return {
        isInstalled: false,
        installationId: null,
        repositoryExists: null,
        repositoryPrivate: null,
        permissions: null,
        hasRequiredPermissions: false,
        missingPermissions: [],
        message:
          "GitHub App is not installed on this repository or the repository is not accessible",
        installationUrl: newInstallUrl(),
        settingsUrl: appInstallUrl(),
      };
    }

    throw new HTTPException(500, {
      message: `Failed to verify GitHub installation: ${(error as Error).message || "Unknown error"}`,
    });
  }

  let repo: {
    id: number;
    private: boolean;
    owner: { id: number; login: string };
  };
  try {
    const installationOctokit = await githubApp.getInstallationOctokit(
      installation.id,
    );
    const { data } = await installationOctokit.rest.repos.get({
      owner: repositoryOwner,
      repo: repositoryName,
    });
    repo = data;
  } catch (error) {
    if (isGithubNotFound(error)) {
      return {
        isInstalled: true,
        installationId: installation.id,
        repositoryExists: false,
        repositoryPrivate: null,
        permissions: installation.permissions ?? null,
        hasRequiredPermissions: false,
        missingPermissions: [],
        message:
          "GitHub App is installed but the repository is no longer accessible",
        settingsUrl: settingsUrlFor(installation.id),
        installationUrl: appInstallUrl(),
      };
    }

    throw new HTTPException(500, {
      message: `Failed to verify GitHub installation: ${(error as Error).message || "Unknown error"}`,
    });
  }

  const requiredPermissions = ["issues"];
  const hasRequiredPermissions = checkPermissions(
    installation.permissions,
    requiredPermissions,
  );
  const missingPermissions = getMissingPermissions(
    installation.permissions,
    requiredPermissions,
  );
  const accountId = repo.owner.id;

  if (!hasRequiredPermissions) {
    return {
      isInstalled: true,
      installationId: installation.id,
      repositoryExists: true,
      repositoryPrivate: repo.private,
      permissions: installation.permissions ?? null,
      hasRequiredPermissions: false,
      missingPermissions,
      message: `GitHub App is installed but missing required permissions: ${missingPermissions.join(", ")}`,
      settingsUrl: settingsUrlFor(installation.id),
      installationUrl: newInstallUrl(accountId),
    };
  }

  return {
    isInstalled: true,
    installationId: installation.id,
    repositoryExists: true,
    repositoryPrivate: repo.private,
    permissions: installation.permissions ?? null,
    hasRequiredPermissions: true,
    missingPermissions: [],
    message:
      "GitHub App is properly installed and has all required permissions",
    settingsUrl: settingsUrlFor(installation.id),
    installationUrl: newInstallUrl(accountId),
  };
}

function checkPermissions(
  permissions: Record<string, string> | undefined,
  required: string[],
): boolean {
  if (!permissions) return false;

  return required.every((perm) => {
    const permissionLevel = permissions[perm];
    return permissionLevel === "write" || permissionLevel === "admin";
  });
}

function getMissingPermissions(
  permissions: Record<string, string> | undefined,
  required: string[],
): string[] {
  if (!permissions) return required;

  return required.filter((perm) => {
    const permissionLevel = permissions[perm];
    return permissionLevel !== "write" && permissionLevel !== "admin";
  });
}

export default verifyGithubInstallation;
