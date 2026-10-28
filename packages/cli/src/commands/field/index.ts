import { Command } from "effect/cli";
import { fieldCreate } from "./create.js";
import { fieldDelete } from "./delete.js";
import { fieldList } from "./list.js";

export const field = Command.make("field").pipe(
  Command.withDescription("Manage the custom fields of a project"),
  Command.withSubcommands([fieldList, fieldCreate, fieldDelete]),
);
