import dotenv from "dotenv";
import { App } from "octokit";

dotenv.config();

const githubApp: App = new App({
  appId: process.env.GITHUB_APP_ID ?? "",
  privateKey: process.env.GITHUB_PRIVATE_KEY ?? "",
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
  },
});

export default githubApp;
