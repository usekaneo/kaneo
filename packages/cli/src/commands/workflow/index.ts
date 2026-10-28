import { Command } from "effect/cli";
import { workflowDelete } from "./delete.js";
import { workflowList } from "./list.js";
import { workflowSet } from "./set.js";

export const workflow = Command.make("workflow").pipe(
  Command.withDescription(
    "Move tasks to a column when GitHub, GitLab or Gitea events arrive",
  ),
  Command.withSubcommands([workflowList, workflowSet, workflowDelete]),
);
