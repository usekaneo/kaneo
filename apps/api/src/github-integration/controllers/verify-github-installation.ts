import { HTTPException } from "hono/http-exception";
import createGithubApp from "../utils/create-github-app";

const githubApp = createGithubApp();

type VerificationResult = {
  isInstalled: boolean;
  installationId: number | null;
  repositoryExists: boolean;
  repositoryPrivate: boolean | null;
  permissions: Record<string, string> | null;
  message: string;
  installationUrl?: string;
  settingsUrl?: string;
  hasRequiredPermissions?: boolean;
  missingPermissions?: string[];
};

async function verifyGithubInstallation({
  repositoryOwner,
  repositoryName,
}: {
  repositoryOwner: string;
  repositoryName: string;
}): Promise<VerificationResult> {
  try {
    if (!githubApp) {
      throw new HTTPException(500, {
        message: "GitHub app not found",
      });
    }

    const { data: installation } =
      await githubApp.octokit.rest.apps.getRepoInstallation({
        owner: repositoryOwner,
        repo: repositoryName,
      });

    const octokit = await githubApp.getInstallationOctokit(installation.id);
    const { data: repo } = await octokit.rest.repos.get({
      owner: repositoryOwner,
      repo: repositoryName,
    });

    const requiredPermissions = ["issues"];
    const hasRequiredPermissions = checkPermissions(
      installation.permissions,
      requiredPermissions,
    );
    const missingPermissions = getMissingPermissions(
      installation.permissions,
      requiredPermissions,
    );

    if (!hasRequiredPermissions) {
      return {
        isInstalled: true,
        installationId: installation.id,
        repositoryExists: true,
        repositoryPrivate: repo.private,
        permissions: installation.permissions,
        hasRequiredPermissions: false,
        missingPermissions,
        message: `GitHub App is installed but missing required permissions: ${missingPermissions.join(", ")}`,
        settingsUrl: `https://github.com/settings/installations/${installation.id}`,
        installationUrl: process.env.GITHUB_APP_NAME
          ? `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new/permissions?target_id=${repo.id}`
          : undefined,
      };
    }

    return {
      isInstalled: true,
      installationId: installation.id,
      repositoryExists: true,
      repositoryPrivate: repo.private,
      permissions: installation.permissions,
      hasRequiredPermissions: true,
      message:
        "GitHub App is properly installed and has all required permissions",
      settingsUrl: `https://github.com/settings/installations/${installation.id}`,
    };
  } catch (error) {
    const githubError = error as { status?: number; message?: string };

    if (githubError.status === 404) {
      try {
        if (!githubApp) {
          throw new HTTPException(500, {
            message: "GitHub app not found",
          });
        }

        await githubApp.octokit.rest.repos.get({
          owner: repositoryOwner,
          repo: repositoryName,
        });

        const repoId = await getRepositoryId(repositoryOwner, repositoryName);

        return {
          isInstalled: false,
          installationId: null,
          repositoryExists: true,
          repositoryPrivate: null,
          permissions: null,
          hasRequiredPermissions: false,
          message: "Repository exists but GitHub App is not installed",
          installationUrl: process.env.GITHUB_APP_NAME
            ? `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new/permissions?target_id=${repoId}`
            : undefined,
          settingsUrl: process.env.GITHUB_APP_NAME
            ? `https://github.com/apps/${process.env.GITHUB_APP_NAME}`
            : undefined,
        };
      } catch (repoError) {
        const repoGithubError = repoError as { status?: number };

        if (repoGithubError.status === 404) {
          return {
            isInstalled: false,
            installationId: null,
            repositoryExists: false,
            repositoryPrivate: null,
            permissions: null,
            hasRequiredPermissions: false,
            message: "Repository does not exist or is not accessible",
          };
        }
        throw repoError;
      }
    }

    throw new HTTPException(500, {
      message: `Failed to verify GitHub installation: ${githubError.message || "Unknown error"}`,
    });
  }
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

async function getRepositoryId(owner: string, repo: string): Promise<number> {
  try {
    if (!githubApp) {
      throw new HTTPException(500, {
        message: "GitHub app not found",
      });
    }

    const { data } = await githubApp.octokit.rest.repos.get({
      owner,
      repo,
    });
    return data.id;
  } catch {
    return 0;
  }
}

export default verifyGithubInstallation;
