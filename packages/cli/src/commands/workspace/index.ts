import { Command } from "effect/cli";
import { workspaceCreate } from "./create.js";
import { workspaceDelete } from "./delete.js";
import { workspaceEdit } from "./edit.js";
import { workspaceLeave } from "./leave.js";
import { workspaceList } from "./list.js";
import { workspaceUse } from "./use.js";

export const workspace = Command.make("workspace").pipe(
  Command.withDescription("Choose, create and manage workspaces"),
  Command.withSubcommands([
    workspaceList,
    workspaceUse,
    workspaceCreate,
    workspaceEdit,
    workspaceLeave,
    workspaceDelete,
  ]),
);
