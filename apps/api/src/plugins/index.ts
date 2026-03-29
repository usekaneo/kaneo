import { githubPlugin, initializeGitHubPlugin } from "./github";
import { initializeEventSubscriptions, registerPlugin } from "./registry";
import { slackPlugin } from "./slack";

export function initializePlugins() {
  console.log("Initializing plugins...");

  registerPlugin(githubPlugin);
  registerPlugin(slackPlugin);
  initializeGitHubPlugin();
  initializeEventSubscriptions();

  console.log("✅ Plugins initialized");
}

export * from "./registry";
export * from "./types";
