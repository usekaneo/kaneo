import { config } from "dotenv-mono";
import { isRegistrationUrlProtected } from "./check-registration-allowed";

config();

function getSettings() {
  return {
    disableRegistration: process.env.DISABLE_REGISTRATION === "true",
    disablePasswordRegistration:
      process.env.DISABLE_PASSWORD_REGISTRATION === "true",
    isRegistrationUrlProtected: isRegistrationUrlProtected(),
    isDemoMode: process.env.DEMO_MODE === "true",
    hasSmtp:
      Boolean(process.env.SMTP_HOST) &&
      Boolean(process.env.SMTP_PORT) &&
      Boolean(process.env.SMTP_SECURE) &&
      Boolean(process.env.SMTP_USER) &&
      Boolean(process.env.SMTP_PASSWORD),
    hasGithubSignIn:
      Boolean(process.env.GITHUB_CLIENT_ID) &&
      Boolean(process.env.GITHUB_CLIENT_SECRET),
    hasGoogleSignIn:
      Boolean(process.env.GOOGLE_CLIENT_ID) &&
      Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasDiscordSignIn:
      Boolean(process.env.DISCORD_CLIENT_ID) &&
      Boolean(process.env.DISCORD_CLIENT_SECRET),
    hasCustomOAuth:
      Boolean(process.env.CUSTOM_OAUTH_CLIENT_ID) &&
      Boolean(process.env.CUSTOM_OAUTH_CLIENT_SECRET),
  };
}

export default getSettings;
