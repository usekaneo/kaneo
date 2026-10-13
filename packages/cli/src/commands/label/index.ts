import { Command } from "effect/cli";
import { labelCreate } from "./create.js";
import { labelDelete } from "./delete.js";
import { labelEdit } from "./edit.js";
import { labelList } from "./list.js";

export const label = Command.make("label").pipe(
  Command.withDescription("Manage workspace labels"),
  Command.withSubcommands([labelList, labelCreate, labelEdit, labelDelete]),
);
