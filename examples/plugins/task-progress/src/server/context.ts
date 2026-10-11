import type { PluginOptions } from "@kaneo/plugin-sdk";
import type { ServerContext } from "@kaneo/plugin-sdk/server";
import type plugin from "../index.js";
import type { settings } from "./settings.js";

export type Kaneo = ServerContext<
  PluginOptions<typeof plugin>,
  typeof settings
>;
