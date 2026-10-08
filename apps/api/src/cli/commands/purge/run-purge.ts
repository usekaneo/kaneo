import { basename } from "node:path";
import { PLUGIN_ID_PATTERN } from "@kaneo/plugin-sdk";
import { loadDeclaredConfig } from "../../../plugin-host/config/load-declared-plugins";
import type { PluginDataCounts } from "../../../plugin-host/data/plugin-data";
import { OFFICIAL_PLUGINS } from "../../../plugin-host/official/official-plugins";
import { CliError } from "../../cli-error";
import type { Output, Prompt } from "../../io";
import { configuredPluginIds } from "./configured-plugin-ids";
import { purgeRefusal } from "./purge-refusal";

export type PurgeInput = {
  pluginId: string;
  yes: boolean;
  configPath: string | null;
};

export type PurgeDependencies = {
  output: Output;
  prompt: Prompt;
  countData: (pluginId: string) => Promise<PluginDataCounts>;
  deleteData: (pluginId: string) => Promise<PluginDataCounts>;
};

function rows(count: number): string {
  return `${count} ${count === 1 ? "row" : "rows"}`;
}

export async function runPurge(
  { pluginId, yes, configPath }: PurgeInput,
  { output, prompt, countData, deleteData }: PurgeDependencies,
): Promise<number> {
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new CliError(
      `"${pluginId}" is not a plugin id. Plugin ids use lowercase letters, digits, and dashes, like kaneo-plugin-task-progress.`,
    );
  }

  const config = await loadDeclaredConfig(configPath);
  const refusal = purgeRefusal({
    pluginId,
    officialIds: OFFICIAL_PLUGINS.map((plugin) => plugin.id),
    officialToggles: config.official,
    configuredIds: configPath
      ? await configuredPluginIds(config.plugins, configPath)
      : [],
    configName: configPath ? basename(configPath) : "kaneo.config.ts",
  });
  if (refusal) throw new CliError(refusal);

  const found = await countData(pluginId);
  if (found.storage === 0 && found.workspaces === 0) {
    output.log(`Plugin "${pluginId}" has no stored data. Nothing to delete.`);
    return 0;
  }
  output.log(
    `Plugin "${pluginId}" has ${rows(found.storage)} in plugin_storage and ${rows(found.workspaces)} in workspace_plugin.`,
  );

  if (!yes) {
    if (!prompt.interactive) {
      throw new CliError(
        `Run kaneo plugin purge ${pluginId} --yes to delete them without a prompt.`,
      );
    }
    const answer = await prompt.ask(
      `This cannot be undone. Type ${pluginId} to delete them: `,
    );
    if (answer !== pluginId) {
      output.error("Cancelled. Nothing was deleted.");
      return 1;
    }
  }

  const deleted = await deleteData(pluginId);
  output.log(`Deleted ${rows(deleted.storage)} from plugin_storage.`);
  output.log(`Deleted ${rows(deleted.workspaces)} from workspace_plugin.`);
  return 0;
}
