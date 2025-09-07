import dotenv from "dotenv";

dotenv.config();

function getSettings() {
  return {
    disableRegistration: process.env.DISABLE_REGISTRATION === "true",
    isDemoMode: process.env.DEMO_MODE === "true",
    hasSmtp:
      Boolean(process.env.SMTP_HOST) &&
      Boolean(process.env.SMTP_PORT) &&
      Boolean(process.env.SMTP_SECURE) &&
      Boolean(process.env.SMTP_USER) &&
      Boolean(process.env.SMTP_PASSWORD),
  };
}

export default getSettings;
