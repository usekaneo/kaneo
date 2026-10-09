import { Command } from "effect/cli";
import { columnCreate } from "./create.js";
import { columnDelete } from "./delete.js";
import { columnEdit } from "./edit.js";
import { columnList } from "./list.js";
import { columnMove } from "./move.js";

export const column = Command.make("column").pipe(
  Command.withDescription("Manage a project's columns"),
  Command.withSubcommands([
    columnList,
    columnCreate,
    columnEdit,
    columnMove,
    columnDelete,
  ]),
);
