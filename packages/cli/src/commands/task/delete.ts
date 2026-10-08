import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { deleteTask } from "../../api/task-mutations.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { renderTaskDeleted } from "../../tasks/render-task-deleted.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

export const runTaskDelete = Effect.fn("command.task.delete")(
  function* (options: { readonly task: string; readonly yes: boolean }) {
    const resolved = yield* withSpinner(`Loading ${options.task}`)(
      resolveTask(options.task),
    );
    const label = resolved.ticketId ?? resolved.task.id.slice(0, 8);

    yield* confirmDestructive({
      yes: options.yes,
      action: `Deleting ${label}`,
      question: `Delete ${label} · ${resolved.task.title}? This cannot be undone.`,
    });

    yield* withSpinner(`Deleting ${label}`)(deleteTask(resolved.task.id));
    yield* emit(
      {
        id: resolved.task.id,
        ticketId: resolved.ticketId,
        title: resolved.task.title,
        deleted: true,
      },
      (ui) => renderTaskDeleted(ui, { label, title: resolved.task.title }),
    );
  },
);

export const taskDelete = Command.make(
  "delete",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runTaskDelete(options),
).pipe(
  Command.withDescription(
    "Permanently delete a task with its comments and time entries",
  ),
  Command.provide(ApiLayer),
);
