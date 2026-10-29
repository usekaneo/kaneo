import { isSmtpConfigured } from "@kaneo/email";
import { config } from "dotenv-mono";
import { isBillingEnabled } from "../billing/config";
import {
  DEFAULT_STORED_SETTINGS,
  type InstanceSettings,
  resolveInstanceSettings,
} from "../instance-settings/resolve-instance-settings";
import { isStorageConfigured } from "../storage/s3";
import {
  parseCustomOAuthAccountUrl,
  parseManagedProfileFields,
} from "./custom-oauth-env";
import { resolveFileSecret } from "./file-secret";
import { isGithubSsoConfigured } from "./github-sso-env";
import { isCloud } from "./is-cloud";

config();

function getSettings(
  instance: InstanceSettings = resolveInstanceSettings(
    DEFAULT_STORED_SETTINGS,
    process.env,
  ),
) {
  return {
    isCloud: isCloud(),
    instanceName: instance.instanceName,
    disableRegistration: !instance.registrationEnabled,
    disablePasswordRegistration: !instance.passwordRegistrationEnabled,
    disableEmailOtpSignIn: process.env.DISABLE_EMAIL_OTP_SIGN_IN === "true",
    disableWorkspaceCreation: instance.workspaceCreationRestricted,
    disabledIntegrations: instance.disabledIntegrations,
    isDemoMode: process.env.DEMO_MODE === "true",
    hasSmtp: isSmtpConfigured(),
    hasImageUploads: isStorageConfigured(),
    hasGithubSignIn: isGithubSsoConfigured(),
    hasGoogleSignIn:
      Boolean(process.env.GOOGLE_CLIENT_ID) &&
      Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasDiscordSignIn:
      Boolean(process.env.DISCORD_CLIENT_ID) &&
      Boolean(process.env.DISCORD_CLIENT_SECRET),
    hasCustomOAuth:
      Boolean(process.env.CUSTOM_OAUTH_CLIENT_ID) &&
      Boolean(resolveFileSecret("CUSTOM_OAUTH_CLIENT_SECRET")),
    // Mirrors `isGuestAccessAvailable`.
    hasGuestAccess:
      process.env.DISABLE_GUEST_ACCESS !== "true" &&
      process.env.DISABLE_LOGIN_FORM !== "true" &&
      instance.registrationEnabled &&
      instance.passwordRegistrationEnabled,
    disableLoginForm: process.env.DISABLE_LOGIN_FORM === "true",
    customOAuthName: process.env.CUSTOM_OAUTH_NAME?.trim() || null,
    customOAuthAutoLogin: process.env.CUSTOM_OAUTH_AUTO_LOGIN === "true",
    customOAuthLogoutUrl: process.env.CUSTOM_OAUTH_LOGOUT_URL || null,
    customOAuthManagedProfileFields: parseManagedProfileFields(),
    customOAuthAccountUrl: parseCustomOAuthAccountUrl(),
    billingEnabled: isBillingEnabled(),
  };
}

export default getSettings;
