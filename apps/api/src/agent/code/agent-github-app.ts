import { HTTPException } from "hono/http-exception";
import {
  getGithubAppClient,
  getVerifiedRepository,
} from "../../plugins/github/utils/github-app-client";
import { getCodeJobsConfig } from "./config";

export type CodeRepository = {
  repositoryOwner: string;
  repositoryName: string;
  repositoryId: number;
};

export function getAgentGithubApp() {
  const config = getCodeJobsConfig();
  if (!config) return null;
  return getGithubAppClient(
    "agent",
    {
      appId: config.appId,
      privateKey: config.privateKey,
    },
    true,
  );
}

export class RepositoryUnavailableError extends Error {
  constructor() {
    super("repository_unavailable");
  }
}

/**
 * An installation client for the Kaneo Agent App on this repository. Throws
 * RepositoryUnavailableError when the App is not installed there or the
 * repository was replaced under the same name.
 */
export async function getAgentRepositoryAccess(repository: CodeRepository) {
  const app = getAgentGithubApp();
  if (!app)
    throw new HTTPException(503, {
      message: "Coding jobs are not configured on this instance",
    });
  let installationId: number;
  try {
    const { data } = await app.octokit.rest.apps.getRepoInstallation({
      owner: repository.repositoryOwner,
      repo: repository.repositoryName,
    });
    if (
      data.permissions.contents !== "write" ||
      data.permissions.pull_requests !== "write" ||
      data.permissions.actions !== "write"
    )
      throw new RepositoryUnavailableError();
    installationId = data.id;
  } catch (error) {
    if (isStatus(error, 404)) throw new RepositoryUnavailableError();
    throw error;
  }
  const octokit = await app.getInstallationOctokit(installationId);
  try {
    const data = await getVerifiedRepository(octokit, repository);
    return { octokit, repository: data };
  } catch (error) {
    if (isStatus(error, 404) || !hasStatus(error))
      throw new RepositoryUnavailableError();
    throw error;
  }
}

export function hasStatus(error: unknown): error is { status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  );
}

export function isStatus(error: unknown, status: number) {
  return hasStatus(error) && error.status === status;
}
