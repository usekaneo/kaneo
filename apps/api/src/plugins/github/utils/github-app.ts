import * as Sentry from "@sentry/node";
import { config } from "dotenv-mono";
import type { App } from "octokit";
import { type GitHubConfig, hasVerifiedGitHubBinding } from "../config";
import {
  getGithubAppClient,
  getVerifiedRepository,
  resolveGithubPrivateKey,
} from "./github-app-client";

config();

export { resolveGithubPrivateKey };

export function getGithubApp(boundedImport = false): App | null {
  const privateKey = resolveGithubPrivateKey();
  if (
    !process.env.GITHUB_WEBHOOK_SECRET ||
    !process.env.GITHUB_APP_ID ||
    !privateKey
  ) {
    return null;
  }
  return getGithubAppClient(
    "integration",
    {
      appId: process.env.GITHUB_APP_ID,
      privateKey,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    },
    boundedImport,
  );
}

export async function getInstallationOctokit(
  installationId: number,
  boundedImport = false,
) {
  const app = getGithubApp(boundedImport);
  if (!app) {
    throw new Error("GitHub App not configured");
  }
  Sentry.addBreadcrumb({
    category: "integration",
    level: "info",
    data: { integration: "github", op: "installationOctokit" },
  });
  return app.getInstallationOctokit(installationId);
}

export async function getInstallationIdForRepo(
  owner: string,
  repo: string,
): Promise<number> {
  const app = getGithubApp();
  if (!app) {
    throw new Error("GitHub App not configured");
  }

  Sentry.addBreadcrumb({
    category: "integration",
    level: "info",
    data: {
      integration: "github",
      op: "getInstallationIdForRepo",
    },
  });

  const { data: installation } =
    await app.octokit.rest.apps.getRepoInstallation({
      owner,
      repo,
    });

  return installation.id;
}

/** Prevent name reuse or transfer from redirecting writes to a different repository. */
export async function getVerifiedInstallationOctokit(
  config: GitHubConfig,
  boundedImport = false,
) {
  if (!hasVerifiedGitHubBinding(config) || !config.installationId) {
    throw new Error("GitHub integration requires verification");
  }
  const octokit = await getInstallationOctokit(
    config.installationId,
    boundedImport,
  );
  await getVerifiedRepository(octokit, config);
  return octokit;
}
