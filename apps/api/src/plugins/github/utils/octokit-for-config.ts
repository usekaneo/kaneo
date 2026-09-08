import { Octokit } from "octokit";
import type { GitHubConfig } from "../config";
import { getGithubApp, getInstallationIdForRepo } from "./github-app";

/**
 * Resolve the Octokit client an integration should use, per project.
 *
 * When the integration carries a Personal Access Token, authenticate as that
 * token — this is what lets projects link repos in unrelated personal accounts
 * without installing the shared GitHub App. Otherwise fall back to the existing
 * App-installation client keyed by the repo's installation id, so instances
 * already using the GitHub App are unaffected.
 */
export async function getOctokitForConfig(
  config: Pick<
    GitHubConfig,
    "accessToken" | "installationId" | "repositoryOwner" | "repositoryName"
  >,
): Promise<Octokit> {
  if (config.accessToken) {
    return new Octokit({ auth: config.accessToken });
  }

  const app = getGithubApp();
  if (!app) {
    throw new Error("GitHub App not configured");
  }

  let installationId = config.installationId ?? null;
  if (!installationId) {
    installationId = await getInstallationIdForRepo(
      config.repositoryOwner,
      config.repositoryName,
    );
  }

  // App installation clients are Octokit instances; the cast keeps a single
  // return type for callers regardless of which auth path produced it.
  return (await app.getInstallationOctokit(
    installationId,
  )) as unknown as Octokit;
}

/** True when this integration authenticates with its own token, not the App. */
export function usesAccessToken(
  config: Pick<GitHubConfig, "accessToken">,
): boolean {
  return Boolean(config.accessToken);
}
