import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { getCurrentUser } from "../../api/endpoints.js";
import { createTimeEntry } from "../../api/time-entries.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { formatDue } from "../../render/task-format.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { askDuration } from "../../time/ask-duration.js";
import { askTask } from "../../time/ask-task.js";
import { formatDuration } from "../../time/duration.js";
import { taskRef } from "../../time/find-running-timer.js";
import { logRange } from "../../time/log-range.js";
import { renderTimerChange } from "../../time/render-timer-change.js";
import { toTimeEntryJson } from "../../time/time-entry-json.js";
import { ApiLayer } from "../api-layer.js";
import { noteFlag } from "./note-flag.js";

export const runTimeLog = Effect.fn("command.time.log")(function* (options: {
  readonly task: Option.Option<string>;
  readonly duration: Option.Option<string>;
  readonly date: string;
  readonly note: Option.Option<string>;
}) {
  const reference = yield* askTask(options.task, "kaneo time log KAN-12 1h30m");
  const seconds = yield* askDuration(
    options.duration,
    `kaneo time log ${reference} 1h30m`,
  );
  const now = new Date();
  const range = yield* Effect.fromResult(logRange(seconds, options.date, now));
  const [user, resolved] = yield* withSpinner(`Loading ${reference}`)(
    Effect.all([getCurrentUser(), resolveTask(reference)], { concurrency: 2 }),
  );
  const task = taskRef(resolved);
  const label = task.ticketId ?? task.id.slice(0, 8);
  const description = Option.getOrUndefined(options.note)?.trim();

  const entry = yield* withSpinner(`Logging time on ${label}`)(
    createTimeEntry({
      taskId: task.id,
      startTime: range.startTime,
      endTime: range.endTime,
      ...(description ? { description } : {}),
    }),
  );

  yield* emit(
    {
      ...toTimeEntryJson(entry, task.ticketId, now, user.name),
      taskTitle: task.title,
      url: task.url,
    },
    (ui) =>
      renderTimerChange(ui, {
        verb: "Logged",
        label,
        url: task.url,
        details: [
          formatDuration(seconds),
          formatDue(new Date(range.startTime), now),
          description ?? "",
        ],
      }),
  );
});

export const timeLog = Command.make(
  "log",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
      Argument.optional,
    ),
    duration: Argument.String("duration").pipe(
      Argument.withDescription("How long, for example 1h30m, 45m, 2h or 1.5h"),
      Argument.optional,
    ),
    date: Flag.String("date").pipe(
      Flag.withDescription(
        "Day the work happened: today, yesterday, or YYYY-MM-DD",
      ),
      Flag.withDefault("today"),
    ),
    note: noteFlag,
  },
  (options) => runTimeLog(options),
).pipe(
  Command.withDescription("Log time you already spent on a task"),
  Command.provide(ApiLayer),
);
