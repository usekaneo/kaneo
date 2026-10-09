import { Command } from "effect/cli";
import { profileList } from "./list.js";
import { profileRemove } from "./remove.js";
import { profileRename } from "./rename.js";
import { profileUse } from "./use.js";

export const profile = Command.make("profile").pipe(
  Command.withDescription("Manage stored logins"),
  Command.withSubcommands([
    profileList,
    profileUse,
    profileRename,
    profileRemove,
  ]),
);
