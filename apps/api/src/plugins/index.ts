import { discordPlugin } from "./discord";
import { genericWebhookPlugin } from "./generic-webhook";
import { githubPlugin, initializeGitHubPlugin } from "./github";
import { initializeEventSubscriptions, registerPlugin } from "./registry";
import { slackPlugin } from "./slack";
import { telegramPlugin } from "./telegram";

export function initializePlugins() {
  console.log("Initializing plugins...");

  registerPlugin(githubPlugin);
  registerPlugin(slackPlugin);
  registerPlugin(discordPlugin);
  registerPlugin(genericWebhookPlugin);
  registerPlugin(telegramPlugin);
  initializeGitHubPlugin();
  initializeEventSubscriptions();

  console.log("✅ Plugins initialized");
}

export * from "./registry";
export * from "./types";
