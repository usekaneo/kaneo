import { Command } from "effect/cli";
import { buildCommand } from "./build-command.js";
import { globalFlags } from "./global-flags.js";

export const root = Command.make("kaneo-plugin").pipe(
  Command.withDescription(
    "Build Kaneo plugins. Docs: https://kaneo.app/docs/core/plugins/writing-plugins",
  ),
  Command.withSubcommands([buildCommand]),
  Command.withGlobalFlags(globalFlags),
);
