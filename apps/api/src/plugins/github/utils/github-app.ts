import { config } from "dotenv-mono";
import { App } from "octokit";

config();

let githubAppInstance: App | null = null;

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

export function getGithubApp(): App | null {
  if (githubAppInstance) {
    return githubAppInstance;
  }

  const privateKey = resolveGithubPrivateKey();
  if (
    !process.env.GITHUB_WEBHOOK_SECRET ||
    !process.env.GITHUB_APP_ID ||
    !privateKey
  ) {
    return null;
  }

  githubAppInstance = new App({
    appId: process.env.GITHUB_APP_ID ?? "",
    privateKey,
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
