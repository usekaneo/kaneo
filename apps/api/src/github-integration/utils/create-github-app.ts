import { config } from "dotenv-mono";
import { App } from "octokit";

config();

function createGithubApp(): App | null {
  if (
    !process.env.GITHUB_WEBHOOK_SECRET ||
    !process.env.GITHUB_APP_ID ||
    !process.env.GITHUB_PRIVATE_KEY
  ) {
    return null;
  }

  const githubApp: App = new App({
    appId: process.env.GITHUB_APP_ID ?? "",
    privateKey: process.env.GITHUB_PRIVATE_KEY ?? "",
    webhooks: {
      secret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
    },
  });

  return githubApp;
}

export default createGithubApp;
