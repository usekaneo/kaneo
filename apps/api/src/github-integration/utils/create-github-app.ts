import dotenv from "dotenv";
import { App } from "octokit";

dotenv.config();

if (
  !process.env.GITHUB_APP_ID ||
  !process.env.GITHUB_PRIVATE_KEY ||
  !process.env.GITHUB_WEBHOOK_SECRET
) {
  throw new Error(
    "GITHUB_APP_ID, GITHUB_PRIVATE_KEY and GITHUB_WEBHOOK_SECRET must be set",
  );
}

const githubApp: App = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_PRIVATE_KEY,

  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
  },
});

export default githubApp;
