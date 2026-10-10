import { pathToFileURL } from "node:url";
import {
  isServerPluginDefinition,
  type ServerPluginDefinition,
} from "@kaneo/plugin-sdk/server";
import { StageError } from "./stage-error.js";

export async function importServer(
  path: string,
): Promise<ServerPluginDefinition> {
  const module: { default?: unknown } = await import(pathToFileURL(path).href);
  if (!isServerPluginDefinition(module.default)) {
    throw new StageError(
      `${path} does not export a server plugin created with defineServer() as its default export.`,
      "Report this to the plugin's author.",
    );
  }
  return module.default;
}
