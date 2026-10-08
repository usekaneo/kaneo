import type { PluginLoadStage } from "../load-error";

export function stageHint(
  stage: PluginLoadStage,
  configPath: string,
  kaneoVersion: string | null,
): string {
  switch (stage) {
    case "resolve":
      return `Install the plugin in the project next to ${configPath}, or remove it from the config.`;
    case "entry":
    case "import":
      return "Reinstall the plugin. If it keeps failing, report it to the plugin's author.";
    case "compatibility":
      return `Install a version that supports Kaneo ${kaneoVersion ?? "this release"}, or remove it from ${configPath}.`;
    case "options":
      return `Fix the options passed to the plugin in ${configPath}.`;
    case "start":
    case "config":
      return `Check the plugin's options in ${configPath}, or remove it from the config.`;
  }
}
