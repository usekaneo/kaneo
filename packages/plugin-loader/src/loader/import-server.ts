import { pathToFileURL } from "node:url";
import { checkSettingsSchema } from "@kaneo/plugin-sdk";
import {
  isServerPluginDefinition,
  type ServerPluginDefinition,
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
  const [problem] = checkSettingsSchema(module.default.settings ?? {});
  if (problem) {
    throw new StageError(
      `The plugin's settings schema is invalid. ${problem}.`,
      REPORT_TO_AUTHOR,
    );
  }
  return module.default;
}
