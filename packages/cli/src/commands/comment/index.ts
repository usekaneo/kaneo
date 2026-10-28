import { Command } from "effect/cli";
import { commentAdd } from "./add.js";
import { commentDelete } from "./delete.js";
import { commentEdit } from "./edit.js";
import { commentList } from "./list.js";

export const comment = Command.make("comment").pipe(
  Command.withDescription("Read and manage task comments"),
  Command.withSubcommands([
    commentList,
    commentAdd,
    commentEdit,
    commentDelete,
  ]),
);
