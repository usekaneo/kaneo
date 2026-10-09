import { Command } from "effect/cli";
import { projectArchive } from "./archive.js";
import { projectCreate } from "./create.js";
import { projectDelete } from "./delete.js";
import { projectEdit } from "./edit.js";
import { projectList } from "./list.js";
import { projectMove } from "./move.js";
import { projectUnarchive } from "./unarchive.js";
import { projectView } from "./view.js";

export const project = Command.make("project").pipe(
  Command.withDescription("Create, change and inspect projects"),
  Command.withSubcommands([
    projectList,
    projectView,
    projectCreate,
    projectEdit,
    projectArchive,
    projectUnarchive,
    projectMove,
    projectDelete,
  ]),
);
