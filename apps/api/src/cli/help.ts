export type HelpTopic = "kaneo" | "check" | "add" | "plugin" | "plugin purge";

const PROJECT_DIR =
  "The project directory is --project <dir>, else KANEO_PROJECT_DIR, else /kaneo if it exists, else the current directory.";

const HELP: Record<HelpTopic, string[]> = {
  kaneo: [
    "Usage: kaneo <command> [options]",
    "",
    "Commands:",
    "  add <package>        Install the newest plugin release that supports this Kaneo and add it to kaneo.config.ts",
    "  check                Run the plugin startup checks without starting Kaneo",
    "  plugin purge <id>    Delete the data a removed plugin stored",
    "",
    "Options:",
    "  -h, --help           Show help for a command, like kaneo add --help",
    "  -v, --version        Print the Kaneo version",
    "",
    PROJECT_DIR,
  ],
  check: [
    "Usage: kaneo check [--config <path>] [--project <dir>]",
    "",
    "Runs the startup checks (resolve, entry, compatibility, options, import) for the",
    "built-in plugins and the plugins in kaneo.config.ts. It never runs a plugin's setup",
    "and never connects to the database. Exits with 1 if a plugin would stop Kaneo from starting.",
    "",
    "Options:",
    "  --config <path>      Config file to check. Defaults to KANEO_CONFIG, else kaneo.config.ts,",
    "                       kaneo.config.js, or kaneo.config.mjs in the project directory",
    "  --project <dir>      Project directory",
    "  -h, --help           Show this help",
    "",
    PROJECT_DIR,
  ],
  add: [
    "Usage: kaneo add <package> [--yes] [--project <dir>]",
    "",
    "Installs the newest stable release of <package> whose engines.kaneo range includes",
    "this Kaneo version, pins it with npm install --save-exact, and adds the plugin to",
    "kaneo.config.ts. npm does the lookup and the install, so .npmrc and private registries work.",
    "",
    "Options:",
    "  -y, --yes            Add a package that is not in the Kaneo plugin catalog without asking",
    "  --project <dir>      Project directory",
    "  -h, --help           Show this help",
    "",
    "Environment:",
    "  KANEO_PLUGIN_CATALOG_URL   Catalog index to check the package against",
    "",
    PROJECT_DIR,
  ],
  plugin: [
    "Usage: kaneo plugin <command>",
    "",
    "Commands:",
    "  purge <id>           Delete the data a removed plugin stored",
  ],
  "plugin purge": [
    "Usage: kaneo plugin purge <id> [--yes] [--config <path>] [--project <dir>]",
    "",
    "Deletes the plugin's rows in plugin_storage and workspace_plugin, in every workspace.",
    "The plugin must not be installed: remove it from kaneo.config.ts, or turn a built-in",
    "plugin off there, before purging. Connects with DATABASE_URL or the POSTGRES_* variables.",
    "",
    "Options:",
    "  -y, --yes            Delete without asking. Required when not running in a terminal",
    "  --config <path>      Config file. Defaults to KANEO_CONFIG, else kaneo.config.ts,",
    "                       kaneo.config.js, or kaneo.config.mjs in the project directory",
    "  --project <dir>      Project directory",
    "  -h, --help           Show this help",
    "",
    PROJECT_DIR,
  ],
};

export function helpText(topic: HelpTopic): string {
  return HELP[topic].join("\n");
}
