import { Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";
import type { Column } from "../../api/schemas.js";
import { updateTaskStatus } from "../../api/task-actions.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { pick } from "../../prompts/pick.js";
import { renderCell, text } from "../../render/cell.js";
import { statusDot } from "../../render/task-format.js";
import { matchColumn } from "../../tasks/match-column.js";
import {
  renderStatusChange,
  type StatusRef,
} from "../../tasks/render-status-change.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

function statusRef(columns: ReadonlyArray<Column>, slug: string): StatusRef {
  const column = columns.find((candidate) => candidate.slug === slug);
  return {
    slug,
    name: column?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    isFinal: column?.isFinal ?? false,
  };
}

export const runTaskStatus = Effect.fn("command.task.status")(
  function* (options: {
    readonly task: string;
    readonly status: Option.Option<string>;
  }) {
    const output = yield* Output;
    const resolved = yield* withSpinner(`Loading ${options.task}`)(
      resolveTask(options.task, { columns: true }),
    );
    const label = resolved.ticketId ?? resolved.task.id.slice(0, 8);
    const columns = [...resolved.columns].sort(
      (a, b) => a.position - b.position,
    );
    const slugs = columns.map((column) => column.slug).join(", ");
    if (columns.length === 0) {
      return yield* new InvalidArgument({
        message: `${resolved.project.name} has no columns to move ${label} to.`,
      });
    }

    const target: Column = yield* Option.match(options.status, {
      onSome: (reference) => {
        const match = matchColumn(columns, reference);
        return match
          ? Effect.succeed(match)
          : Effect.fail(
              new InvalidArgument({
                message: `No column in ${resolved.project.name} matches "${reference}".`,
                hint: `Use one of: ${slugs}.`,
              }),
            );
      },
      onNone: () =>
        output.interactive
          ? pick(
              `Move ${label} to`,
              columns.map((column) => ({
                title: renderCell(
                  [
                    statusDot(output.ui, column.slug, column.isFinal),
                    text(` ${column.name}`),
                  ],
                  output.ui,
                ),
                value: column,
                description:
                  column.slug === resolved.task.status
                    ? `${column.slug}, current`
                    : column.slug,
              })),
            )
          : Effect.fail(
              new InvalidArgument({
                message: `Pass the column to move ${label} to.`,
                hint: `Use one of: ${slugs}.`,
              }),
            ),
    });

    const from = statusRef(columns, resolved.task.status);
    if (target.slug !== resolved.task.status) {
      yield* withSpinner(`Moving ${label}`)(
        updateTaskStatus(resolved.task.id, target.slug),
      );
    }
    const to = {
      slug: target.slug,
      name: target.name,
      isFinal: target.isFinal,
    };

    yield* emit(
      {
        id: resolved.task.id,
        ticketId: resolved.ticketId,
        from: { slug: from.slug, name: from.name },
        to: { slug: to.slug, name: to.name },
        url: resolved.url,
      },
      (ui) => renderStatusChange(ui, { label, url: resolved.url, from, to }),
    );
  },
);

export const taskStatus = Command.make(
  "status",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    status: Argument.String("status").pipe(
      Argument.withDescription(
        "Column slug or name, for example in-progress or Done",
      ),
      Argument.optional,
    ),
  },
  (options) => runTaskStatus(options),
).pipe(
  Command.withDescription("Move a task to another column of its project"),
  Command.provide(ApiLayer),
);
