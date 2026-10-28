import { App, Octokit } from "octokit";
import { boundedGithubFetch } from "../../../utils/bounded-github-fetch";
import { resolveFileSecret } from "../../../utils/file-secret";

export type GithubAppCredentials = {
  appId: string;
  privateKey: string;
  webhookSecret?: string;
};

const apps = new Map<string, App>();

// Resolve a GitHub App private key from env in whichever form the host can
// carry. Orchestrators like Portainer's form-based stack editor strip real
// newlines from env values, so users end up with either an empty key or a
// single line containing literal "\n" sequences. Supported shapes:
//
//   1. NAME = real multi-line PEM (the canonical form), or NAME_FILE = a path
//   2. NAME = single line with literal `\n` separators
//   3. NAME_BASE64 = base64-encoded PEM (no newline issues)
//
// Returns "" when nothing is set; the caller's existence check handles that.
export function resolveGithubPrivateKey(name = "GITHUB_PRIVATE_KEY"): string {
  const base64 = process.env[`${name}_BASE64`];
  if (base64 && base64.trim() !== "") {
    return Buffer.from(base64.trim(), "base64").toString("utf8");
  }
  const raw = resolveFileSecret(name) ?? "";
  if (raw.includes("\\n") && !raw.includes("\n")) {
    return raw.replace(/\\n/g, "\n");
  }
  return raw;
}

/** One cached Octokit App per credential set, shared by the integration and agent Apps. */
export function getGithubAppClient(
  cacheKey: string,
  credentials: GithubAppCredentials,
  boundedImport = false,
): App {
  const key = `${cacheKey}:${credentials.appId}:${boundedImport}`;
  const existing = apps.get(key);
  if (existing) return existing;
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
    appId: credentials.appId,
    privateKey: credentials.privateKey,
    ...(credentials.webhookSecret
      ? { webhooks: { secret: credentials.webhookSecret } }
      : {}),
  });
  apps.set(key, app);
  return app;
}

type RepositoryReader = Pick<Octokit, "rest">;

/** Prevent name reuse or transfer from redirecting writes to a different repository. */
export async function getVerifiedRepository(
  octokit: RepositoryReader,
  binding: {
    repositoryOwner: string;
    repositoryName: string;
    repositoryId?: number;
  },
) {
  const { data: repository } = await octokit.rest.repos.get({
    owner: binding.repositoryOwner,
    repo: binding.repositoryName,
    request: { timeout: 10_000 },
  });
  if (repository.id !== binding.repositoryId) {
    throw new Error(
      "GitHub repository identity changed; reconnect the integration",
    );
  }
  return repository;
}
