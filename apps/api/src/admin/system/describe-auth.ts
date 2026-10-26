import getSettings from "../../utils/get-settings";
import { resolveFileSecret } from "../../utils/file-secret";
import { credentialSetStatus } from "./credential-set-status";
import type { ServiceStatus } from "./service-status";

export type AuthProvider = {
  id: "github" | "google" | "discord" | "custom";
  name: string;
  status: ServiceStatus;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

// An unreadable *_FILE secret counts as missing instead of failing the page.
function customOAuthSecret() {
  try {
    return resolveFileSecret("CUSTOM_OAUTH_CLIENT_SECRET");
  } catch {
    return undefined;
  }
}

function customOAuthEndpoint() {
  if (env("CUSTOM_OAUTH_DISCOVERY_URL")) return "discovery";
  return env("CUSTOM_OAUTH_AUTHORIZATION_URL") && env("CUSTOM_OAUTH_TOKEN_URL")
    ? "manual"
    : "";
}

/**
 * Which sign-in paths this instance offers. Only booleans and display names
 * leave here: never client ids, secrets, or provider URLs.
 */
export function describeAuth() {
  const settings = getSettings();
  const providers: AuthProvider[] = [
    {
      id: "github",
      name: "GitHub",
      status: credentialSetStatus([
        env("GITHUB_OAUTH_CLIENT_ID") || env("GITHUB_CLIENT_ID"),
        env("GITHUB_OAUTH_CLIENT_SECRET") || env("GITHUB_CLIENT_SECRET"),
      ]),
    },
    {
      id: "google",
      name: "Google",
      status: credentialSetStatus([
        env("GOOGLE_CLIENT_ID"),
        env("GOOGLE_CLIENT_SECRET"),
      ]),
    },
    {
      id: "discord",
      name: "Discord",
      status: credentialSetStatus([
        env("DISCORD_CLIENT_ID"),
        env("DISCORD_CLIENT_SECRET"),
      ]),
    },
    {
      id: "custom",
      name: settings.customOAuthName ?? "OIDC",
      status: credentialSetStatus([
        env("CUSTOM_OAUTH_CLIENT_ID"),
        customOAuthSecret(),
        customOAuthEndpoint(),
      ]),
    },
  ];

  return {
    passwordSignIn: !settings.disableLoginForm,
    // Mirrors isEmailCodeSignInAvailable in auth.ts.
    emailOtpSignIn:
      settings.hasSmtp &&
      !settings.disableEmailOtpSignIn &&
      !settings.disableLoginForm,
    registration: !settings.disableRegistration,
    passwordRegistration:
      !settings.disableRegistration && !settings.disablePasswordRegistration,
    guestAccess: settings.hasGuestAccess,
    workspaceCreation: !settings.disableWorkspaceCreation,
    providers,
  };
}
