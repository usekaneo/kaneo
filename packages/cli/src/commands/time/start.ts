import { Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";
import { getCurrentUser } from "../../api/endpoints.js";
import { createTimeEntry } from "../../api/time-entries.js";
import { Cancelled, InvalidArgument } from "../../errors/errors.js";
import { emit, note } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { confirm } from "../../prompts/confirm.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { askTask } from "../../time/ask-task.js";
import { formatDuration } from "../../time/duration.js";
import { entrySeconds } from "../../time/entry-seconds.js";
import { findRunningTimer, taskRef } from "../../time/find-running-timer.js";
import { renderTimerChange } from "../../time/render-timer-change.js";
import { stopTimer } from "../../time/stop-timer.js";
import { toTimeEntryJson } from "../../time/time-entry-json.js";
import { rememberTimer } from "../../time/timer-pointer-store.js";
import { ApiLayer } from "../api-layer.js";
import { noteFlag } from "./note-flag.js";

export const runTimeStart = Effect.fn("command.time.start")(
  function* (options: {
    readonly task: Option.Option<string>;
    readonly note: Option.Option<string>;
  }) {
    const output = yield* Output;
    const reference = yield* askTask(options.task, "kaneo time start KAN-12");
    const [user, resolved] = yield* withSpinner(`Loading ${reference}`)(
      Effect.all([getCurrentUser(), resolveTask(reference)], {
        concurrency: 2,
      }),
    );
    const task = taskRef(resolved);
    const label = task.ticketId ?? task.id.slice(0, 8);

    const running = yield* withSpinner("Checking for a running timer")(
      findRunningTimer(user.id),
    );
    if (Option.isSome(running)) {
      const timer = running.value;
      const runningLabel = timer.task.ticketId ?? timer.task.id.slice(0, 8);
      const elapsed = formatDuration(entrySeconds(timer.entry, new Date()));
      const message = `A timer is already running on ${runningLabel} (${elapsed}).`;
      if (timer.task.id === task.id) {
        return yield* new InvalidArgument({
          message,
          hint: "Stop it with kaneo time stop.",
        });
      }
      if (!output.interactive) {
        return yield* new InvalidArgument({
          message,
          hint: `Stop it first with kaneo time stop, then start ${label}.`,
        });
      }
      const switching = yield* confirm(
        `${runningLabel} · ${timer.task.title} has a timer running (${elapsed}). Stop it and start ${label}?`,
      );
      if (!switching) return yield* new Cancelled();
      const stopped = yield* withSpinner(`Stopping ${runningLabel}`)(
        stopTimer(timer, new Date()),
      );
      yield* note((ui) =>
        renderTimerChange(ui, {
          verb: "Stopped",
          label: runningLabel,
          url: timer.task.url,
          details: [formatDuration(entrySeconds(stopped, new Date()))],
        }).slice(0, -1),
      );
    }

    const description = Option.getOrUndefined(options.note)?.trim();
    const entry = yield* withSpinner(`Starting a timer on ${label}`)(
      createTimeEntry({
        taskId: task.id,
        startTime: new Date().toISOString(),
        ...(description ? { description } : {}),
      }),
    );
    yield* rememberTimer({ entryId: entry.id, taskId: entry.taskId });

    yield* emit(
      {
        ...toTimeEntryJson(entry, task.ticketId, new Date(), user.name),
        taskTitle: task.title,
        url: task.url,
      },
      (ui) =>
        renderTimerChange(ui, {
          verb: "Started",
          label,
          url: task.url,
          details: [task.title],
        }),
    );
  },
);

export const timeStart = Command.make(
  "start",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
      Argument.optional,
    ),
    note: noteFlag,
  },
  (options) => runTimeStart(options),
).pipe(
  Command.withDescription("Start a timer on a task"),
  Command.provide(ApiLayer),
);
