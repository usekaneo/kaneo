import { isHttpUrl } from "../utils/is-http-url";

export type BackchannelLogoutConfig =
  | { enabled: false }
  | { enabled: true; discoveryUrl: string; clientId: string };

export function resolveBackchannelLogoutConfig(
  env: NodeJS.ProcessEnv = process.env,
): BackchannelLogoutConfig {
  if (env.CUSTOM_OAUTH_BACKCHANNEL_LOGOUT !== "true") {
    return { enabled: false };
  }

  const discoveryUrl = env.CUSTOM_OAUTH_DISCOVERY_URL?.trim() ?? "";
  if (!isHttpUrl(discoveryUrl)) {
    throw new Error(
      "CUSTOM_OAUTH_BACKCHANNEL_LOGOUT=true requires CUSTOM_OAUTH_DISCOVERY_URL to be an absolute http or https URL.",
    );
  }

  const clientId = env.CUSTOM_OAUTH_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error(
      "CUSTOM_OAUTH_BACKCHANNEL_LOGOUT=true requires CUSTOM_OAUTH_CLIENT_ID.",
    );
  }

  return { enabled: true, discoveryUrl, clientId };
}

export function assertBackchannelLogoutEnv(
  env: NodeJS.ProcessEnv = process.env,
) {
  const requestsOpenId = env.CUSTOM_OAUTH_SCOPES?.split(",").some((entry) =>
    entry.trim().split(" ").includes("openid"),
  );
  if (resolveBackchannelLogoutConfig(env).enabled && !requestsOpenId) {
    console.warn(
      "CUSTOM_OAUTH_BACKCHANNEL_LOGOUT is enabled, but CUSTOM_OAUTH_SCOPES lacks openid. Logout tokens with a session ID will not match any Kaneo session.",
    );
  }
}
