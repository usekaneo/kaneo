import { pathToFileURL } from "node:url";
import { checkSettingsSchema } from "@kaneo/plugin-sdk";
import {
  isServerPluginDefinition,
  type ServerPluginDefinition,
  type SettingsSchema,
} from "@kaneo/plugin-sdk/server";
import { StageError } from "./stage-error.js";

const REPORT_TO_AUTHOR = "Report this to the plugin's author.";

export async function importServer(
  path: string,
): Promise<ServerPluginDefinition> {
  const module: { default?: unknown } = await import(pathToFileURL(path).href);
  if (!isServerPluginDefinition(module.default)) {
    throw new StageError(
      `${path} does not export a server plugin created with defineServer() as its default export.`,
      REPORT_TO_AUTHOR,
    );
  }
  const definition = module.default;
  const settings: unknown = definition.settings ?? {};
  const [problem] = checkSettingsSchema(settings);
  if (problem) {
    throw new StageError(
      `The plugin's settings schema is invalid. ${problem}.`,
      REPORT_TO_AUTHOR,
    );
  }
  return { ...definition, settings: settings as SettingsSchema };
}
