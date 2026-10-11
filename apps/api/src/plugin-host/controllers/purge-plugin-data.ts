import { basename } from "node:path";
import { DEFAULT_CONFIG_PATH, findConfigPath } from "@kaneo/plugin-loader";
import { HTTPException } from "hono/http-exception";
import { deletePluginData, type PluginDataCounts } from "../data/plugin-data";
import { getLoadedPlugin } from "../registry";
import { disabledRefusal, installedRefusal } from "./purge-refusal";

export async function purgePluginData(
  pluginId: string,
): Promise<PluginDataCounts> {
  if (process.env.DISABLE_PLUGINS === "true") {
    throw new HTTPException(409, { message: disabledRefusal(pluginId) });
  }
  const installed = getLoadedPlugin(pluginId);
  if (installed) {
    throw new HTTPException(409, {
      message: installedRefusal(
        pluginId,
        installed.official,
        basename(findConfigPath() ?? DEFAULT_CONFIG_PATH),
      ),
    });
  }
  return deletePluginData(pluginId);
}
