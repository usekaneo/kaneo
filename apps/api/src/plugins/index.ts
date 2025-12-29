import { githubPlugin, initializeGitHubPlugin } from "./github";
import { initializeEventSubscriptions, registerPlugin } from "./registry";

export function initializePlugins() {
  console.log("Initializing plugins...");

  registerPlugin(githubPlugin);
  initializeGitHubPlugin();
  initializeEventSubscriptions();

  console.log("✅ Plugins initialized");
}

export * from "./registry";
export * from "./types";
