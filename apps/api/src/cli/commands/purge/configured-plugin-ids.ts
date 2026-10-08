import type { PluginDescriptor } from "@kaneo/plugin-sdk";
import { errorMessage } from "../../../plugin-host/load-error";
import { guessPackageName } from "../../../plugin-host/loader/guess-package-name";
import { resolvePackage } from "../../../plugin-host/loader/resolve-package";
import { CliError } from "../../cli-error";

export async function configuredPluginIds(
  descriptors: readonly PluginDescriptor[],
  configPath: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (const descriptor of descriptors) {
    try {
      ids.push((await resolvePackage(descriptor.url)).plugin.id);
    } catch (error) {
      throw new CliError(
        `Could not read the plugin "${guessPackageName(descriptor.url)}" in ${configPath}: ${errorMessage(error)}\nPurge needs every plugin in the config to resolve, so it can tell which ones are installed. Run kaneo check and fix the config first.`,
      );
    }
  }
  return ids;
}
