import { isSmtpConfigured } from "@kaneo/email";
import {
  DEFAULT_STORED_SETTINGS,
  type InstanceSettings,
  resolveInstanceSettings,
} from "../../instance-settings/resolve-instance-settings";
import { resolveFileSecret } from "../../utils/file-secret";
import { getGithubSsoOAuthCredentials } from "../../utils/github-sso-env";
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
export function describeAuth(
  instance: InstanceSettings = resolveInstanceSettings(
    DEFAULT_STORED_SETTINGS,
    process.env,
  ),
) {
  const disableLoginForm = process.env.DISABLE_LOGIN_FORM === "true";
  const disableRegistration = !instance.registrationEnabled;
  const disablePasswordRegistration = !instance.passwordRegistrationEnabled;
  const github = getGithubSsoOAuthCredentials();
  const providers: AuthProvider[] = [
    {
      id: "github",
      name: "GitHub",
      // Same resolution as sign-in, so a mixed pair isn't shown as usable.
      status: credentialSetStatus([github.clientId, github.clientSecret]),
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
      name: env("CUSTOM_OAUTH_NAME") || "OIDC",
      status: credentialSetStatus([
        env("CUSTOM_OAUTH_CLIENT_ID"),
        customOAuthSecret(),
        customOAuthEndpoint(),
      ]),
    },
  ];

  return {
    passwordSignIn: !disableLoginForm,
    // Mirrors isEmailCodeSignInAvailable in auth.ts.
    emailOtpSignIn:
      isSmtpConfigured() &&
      process.env.DISABLE_EMAIL_OTP_SIGN_IN !== "true" &&
      !disableLoginForm,
    registration: !disableRegistration,
    passwordRegistration:
      !disableRegistration && !disablePasswordRegistration && !disableLoginForm,
    guestAccess:
      process.env.DISABLE_GUEST_ACCESS !== "true" &&
      !disableRegistration &&
      !disablePasswordRegistration &&
      !disableLoginForm,
    workspaceCreation: !instance.workspaceCreationRestricted,
    providers,
  };
}
