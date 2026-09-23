import * as Sentry from "@sentry/node";
import { config } from "dotenv-mono";
import { App, Octokit } from "octokit";
import { boundedGithubFetch } from "../../../utils/bounded-github-fetch";
import { type GitHubConfig, hasVerifiedGitHubBinding } from "../config";

config();

let githubAppInstance: App | null = null;
let githubImportAppInstance: App | null = null;

// Resolve the GitHub App private key from env in whichever form the host
// can carry. Orchestrators like Portainer's form-based stack editor strip
// real newlines from env values, so users end up with either an empty key
// or a single line containing literal "\n" sequences. Support three shapes:
//
//   1. GITHUB_PRIVATE_KEY = real multi-line PEM (the canonical form)
//   2. GITHUB_PRIVATE_KEY = single line with literal `\n` separators
//   3. GITHUB_PRIVATE_KEY_BASE64 = base64-encoded PEM (no newline issues)
//
// Returns "" when nothing is set; the caller's existence check handles that.
export function resolveGithubPrivateKey(): string {
  const base64 = process.env.GITHUB_PRIVATE_KEY_BASE64;
  if (base64 && base64.trim() !== "") {
    return Buffer.from(base64.trim(), "base64").toString("utf8");
  }
  const raw = process.env.GITHUB_PRIVATE_KEY ?? "";
  if (raw.includes("\\n") && !raw.includes("\n")) {
    return raw.replace(/\\n/g, "\n");
  }
  return raw;
}

export function getGithubApp(boundedImport = false): App | null {
  const existing = boundedImport ? githubImportAppInstance : githubAppInstance;
  if (existing) {
    return existing;
  }

  const privateKey = resolveGithubPrivateKey();
  if (
    !process.env.GITHUB_WEBHOOK_SECRET ||
    !process.env.GITHUB_APP_ID ||
    !privateKey
  ) {
    return null;
  }

  const app = new App({
    ...(boundedImport
      ? {
          Octokit: Octokit.defaults({
            throttle: { enabled: false },
            retry: { enabled: false },
            request: { fetch: boundedGithubFetch, timeout: 10_000 },
          }),
        }
      : {}),
    appId: process.env.GITHUB_APP_ID ?? "",
    privateKey,
    webhooks: {
      secret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
    },
  });

  if (boundedImport) githubImportAppInstance = app;
  else githubAppInstance = app;
  return app;
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
  const { data: repository } = await octokit.rest.repos.get({
    owner: config.repositoryOwner,
    repo: config.repositoryName,
    request: { timeout: 10_000 },
  });
  if (repository.id !== config.repositoryId) {
    throw new Error(
      "GitHub repository identity changed; reconnect the integration",
    );
  }
  return octokit;
}
