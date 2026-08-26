import { discordPlugin } from "./discord";
import { genericWebhookPlugin } from "./generic-webhook";
import { giteaPlugin } from "./gitea";
import { githubPlugin, initializeGitHubPlugin } from "./github";
import { googleChatPlugin } from "./google-chat";
import { initializeEventSubscriptions, registerPlugin } from "./registry";
import { slackPlugin } from "./slack";
import { telegramPlugin } from "./telegram";

export function initializePlugins() {
  console.log("Initializing plugins...");

  registerPlugin(githubPlugin);
  registerPlugin(giteaPlugin);
  registerPlugin(slackPlugin);
  registerPlugin(googleChatPlugin);
  registerPlugin(discordPlugin);
  registerPlugin(genericWebhookPlugin);
  registerPlugin(telegramPlugin);
  initializeGitHubPlugin();
  initializeEventSubscriptions();

  console.log("✅ Plugins initialized");
}

export * from "./registry";
export * from "./types";
