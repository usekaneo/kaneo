import { discordPlugin } from "./discord";
import { genericWebhookPlugin } from "./generic-webhook";
import { giteaPlugin } from "./gitea";
import { githubPlugin, initializeGitHubPlugin } from "./github";
import { initializeEventSubscriptions, registerPlugin } from "./registry";
import { slackPlugin } from "./slack";

export function initializePlugins() {
  console.log("Initializing plugins...");

  registerPlugin(githubPlugin);
  registerPlugin(giteaPlugin);
  registerPlugin(slackPlugin);
  registerPlugin(discordPlugin);
  registerPlugin(genericWebhookPlugin);
  initializeGitHubPlugin();
  initializeEventSubscriptions();

  console.log("✅ Plugins initialized");
}

export * from "./registry";
export * from "./types";
