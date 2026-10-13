import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  countColumnTasks,
  deleteColumn,
  listColumnTaskIds,
} from "../../api/columns.js";
import { updateTaskStatus } from "../../api/task-actions.js";
import { findColumn } from "../../columns/find-column.js";
import { renderColumnChange } from "../../columns/render-column-change.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { pick } from "../../prompts/pick.js";
import { ApiLayer } from "../api-layer.js";
import { loadProjectColumns } from "./load-columns.js";
import { projectFlag } from "./project-flag.js";

const tasksLabel = (count: number) =>
  `${count} ${count === 1 ? "task" : "tasks"}`;

export const runColumnDelete = Effect.fn("command.column.delete")(
  function* (options: {
    readonly column: string;
    readonly project: Option.Option<string>;
    readonly moveTasksTo: Option.Option<string>;
    readonly yes: boolean;
  }) {
    const output = yield* Output;
    const { project, columns } = yield* loadProjectColumns(options.project);
    const column = yield* Effect.fromResult(
      findColumn(columns, options.column),
    );
    const others = columns.filter((candidate) => candidate.id !== column.id);
    const requested = yield* Option.match(options.moveTasksTo, {
      onNone: () => Effect.succeed(undefined),
      onSome: (reference) =>
        Effect.fromResult(
          findColumn(columns, reference, "--move-tasks-to"),
        ).pipe(
          Effect.filterOrFail(
            (target) => target.id !== column.id,
            () =>
              new InvalidArgument({
                message: `--move-tasks-to points at ${column.name}, the column being deleted.`,
                hint: "Pick another column.",
              }),
          ),
        ),
    });
    const count = yield* withSpinner(`Counting tasks in ${column.name}`)(
      countColumnTasks(project.id, column.slug),
    );

    const destination =
      count === 0
        ? undefined
        : (requested ??
          (output.interactive && others.length > 0
            ? yield* pick(
                `${column.name} holds ${tasksLabel(count)}. Move them to`,
                others.map((candidate) => ({
                  title: candidate.name,
                  value: candidate,
                  description: candidate.slug,
                })),
              )
            : yield* new InvalidArgument({
                message: `${column.name} still holds ${tasksLabel(count)}, and the server only deletes empty columns.`,
                hint: "Pass --move-tasks-to <column> to move them first.",
              })));

    yield* confirmDestructive({
      yes: options.yes,
      action: `Deleting column ${column.name}`,
      question: destination
        ? `Move ${tasksLabel(count)} to ${destination.name}, then delete ${column.name}?`
        : `Delete column ${column.name}? This cannot be undone.`,
    });

    let moved = 0;
    if (destination) {
      const taskIds = yield* withSpinner(`Moving tasks to ${destination.name}`)(
        listColumnTaskIds(project.id, column.slug).pipe(
          Effect.tap((ids) =>
            Effect.forEach(
              ids,
              (taskId) => updateTaskStatus(taskId, destination.slug),
              { concurrency: 4, discard: true },
            ),
          ),
        ),
      );
      moved = taskIds.length;
    }
    yield* withSpinner(`Deleting ${column.name}`)(deleteColumn(column.id));

    yield* emit(
      {
        id: column.id,
        projectId: column.projectId,
        name: column.name,
        slug: column.slug,
        deleted: true,
        movedTasks: moved,
        movedTo: destination?.slug ?? null,
      },
      (ui) =>
        renderColumnChange(ui, {
          verb: "Deleted",
          column,
          details: destination
            ? [`moved ${tasksLabel(moved)} to ${destination.name}`]
            : [],
        }),
    );
  },
);

export const columnDelete = Command.make(
  "delete",
  {
    column: Argument.String("column").pipe(
      Argument.withDescription("Column slug, name or id"),
    ),
    project: projectFlag,
    moveTasksTo: Flag.String("move-tasks-to").pipe(
      Flag.withDescription(
        "Move the column's tasks to this column first (required when it holds tasks)",
      ),
      Flag.optional,
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runColumnDelete(options),
).pipe(
  Command.withDescription(
    "Delete a column, moving its tasks to another column first",
  ),
  Command.provide(ApiLayer),
);
