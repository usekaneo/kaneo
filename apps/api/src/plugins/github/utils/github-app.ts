import { config } from "dotenv-mono";
import { App } from "octokit";

config();

let githubAppInstance: App | null = null;

export function getGithubApp(): App | null {
  if (githubAppInstance) {
    return githubAppInstance;
  }

  if (
    !process.env.GITHUB_WEBHOOK_SECRET ||
    !process.env.GITHUB_APP_ID ||
    !process.env.GITHUB_PRIVATE_KEY
  ) {
    return null;
  }

  githubAppInstance = new App({
    appId: process.env.GITHUB_APP_ID ?? "",
    privateKey: process.env.GITHUB_PRIVATE_KEY ?? "",
    webhooks: {
      secret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
    },
  });

  return githubAppInstance;
}

export async function getInstallationOctokit(installationId: number) {
  const app = getGithubApp();
  if (!app) {
    throw new Error("GitHub App not configured");
  }
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

  const { data: installation } =
    await app.octokit.rest.apps.getRepoInstallation({
      owner,
      repo,
    });

  return installation.id;
}
