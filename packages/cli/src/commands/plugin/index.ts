import { Command } from "effect/cli";
import { pluginAdd } from "./add.js";
import { pluginCheck } from "./check.js";
import { pluginList } from "./list.js";
import { pluginPurge } from "./purge.js";

export const plugin = Command.make("plugin").pipe(
  Command.withDescription(
    "List, add and check plugins, and delete a removed plugin's data",
  ),
  Command.withSubcommands([pluginList, pluginAdd, pluginCheck, pluginPurge]),
);
