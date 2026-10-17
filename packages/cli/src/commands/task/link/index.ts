import { Command } from "effect/cli";
import { taskLinkAdd } from "./add.js";
import { taskLinkList } from "./list.js";
import { taskLinkRemove } from "./remove.js";

export const taskLink = Command.make("link").pipe(
  Command.withDescription("List, add and remove a task's links"),
  Command.withSubcommands([taskLinkList, taskLinkAdd, taskLinkRemove]),
);
