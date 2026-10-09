import { Command } from "effect/cli";
import { taskActivity } from "./activity.js";
import { taskAssign } from "./assign.js";
import { taskAttach } from "./attach.js";
import { taskBulk } from "./bulk.js";
import { taskComment } from "./comment.js";
import { taskCreate } from "./create.js";
import { taskDelete } from "./delete.js";
import { taskDuplicate } from "./duplicate.js";
import { taskEdit } from "./edit.js";
import { taskExport } from "./export.js";
import { taskField } from "./field.js";
import { taskImages } from "./images.js";
import { taskImport } from "./import.js";
import { taskLink } from "./link/index.js";
import { taskList } from "./list.js";
import { taskMine } from "./mine.js";
import { taskMove } from "./move.js";
import { taskOpen } from "./open.js";
import { taskRelation } from "./relation.js";
import { taskStatus } from "./status.js";
import { taskView } from "./view.js";

export const task = Command.make("task").pipe(
  Command.withDescription("Work with tasks"),
  Command.withSubcommands([
    taskList,
    taskMine,
    taskView,
    taskCreate,
    taskEdit,
    taskOpen,
    taskStatus,
    taskMove,
    taskDuplicate,
    taskBulk,
    taskAssign,
    taskField,
    taskComment,
    taskAttach,
    taskImages,
    taskRelation,
    taskLink,
    taskActivity,
    taskDelete,
    taskExport,
    taskImport,
  ]),
);
