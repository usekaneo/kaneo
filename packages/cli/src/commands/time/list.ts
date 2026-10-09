import { Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";
import { listTimeEntries } from "../../api/time-entries.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { askTask } from "../../time/ask-task.js";
import { renderTimeEntries } from "../../time/render-time-entries.js";
import { toTimeEntryJson } from "../../time/time-entry-json.js";
import { ApiLayer } from "../api-layer.js";

export const runTimeList = Effect.fn("command.time.list")(function* (options: {
  readonly task: Option.Option<string>;
}) {
  const reference = yield* askTask(options.task, "kaneo time list KAN-12");
  const { resolved, entries } = yield* withSpinner(
    `Loading time on ${reference}`,
  )(
    Effect.gen(function* () {
      const resolved = yield* resolveTask(reference);
      const entries = yield* listTimeEntries(resolved.task.id);
      return { resolved, entries };
    }),
  );
  const now = new Date();
  const json = entries.map((entry) =>
    toTimeEntryJson(entry, resolved.ticketId, now),
  );

  yield* emit(json, (ui) =>
    renderTimeEntries(ui, {
      label: resolved.ticketId ?? resolved.task.id.slice(0, 8),
      url: resolved.url,
      title: resolved.task.title,
      entries: json,
      now,
    }),
  );
});

export const timeList = Command.make(
  "list",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
      Argument.optional,
    ),
  },
  (options) => runTimeList(options),
).pipe(
  Command.withDescription("List the time logged on a task, with a total"),
  Command.provide(ApiLayer),
);
