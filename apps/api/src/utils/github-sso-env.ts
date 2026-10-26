import { resolveFileSecret } from "./file-secret";

/**
 * GitHub "Sign in with GitHub" uses OAuth client credentials.
 * Prefer `GITHUB_OAUTH_*` so GitHub App integration env vars can be set
 * without implicitly enabling SSO. Legacy `GITHUB_CLIENT_*` is still supported.
 */
export function getGithubSsoOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const oauthId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim();
  const oauthSecret = resolveFileSecret("GITHUB_OAUTH_CLIENT_SECRET")?.trim();
  if (oauthId && oauthSecret) {
    return { clientId: oauthId, clientSecret: oauthSecret };
  }
  return {
    clientId: process.env.GITHUB_CLIENT_ID?.trim() || "",
    clientSecret: resolveFileSecret("GITHUB_CLIENT_SECRET")?.trim() || "",
  };
}

export function isGithubSsoConfigured(): boolean {
  const { clientId, clientSecret } = getGithubSsoOAuthCredentials();
  return Boolean(clientId && clientSecret);
}
