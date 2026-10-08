import { Command } from "effect/cli";
import { relationAdd } from "./relation/add.js";
import { relationList } from "./relation/list.js";
import { relationRemove } from "./relation/remove.js";

export const taskRelation = Command.make("relation").pipe(
  Command.withDescription(
    "Work with parents, subtasks, blockers and related tasks",
  ),
  Command.withSubcommands([relationList, relationAdd, relationRemove]),
);
