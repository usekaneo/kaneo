import { Command } from "effect/cli";
import { memberInvite } from "./invite.js";
import { memberList } from "./list.js";
import { memberRemove } from "./remove.js";
import { memberRole } from "./role.js";

export const member = Command.make("member").pipe(
  Command.withDescription("Manage workspace members"),
  Command.withSubcommands([memberList, memberInvite, memberRole, memberRemove]),
);
