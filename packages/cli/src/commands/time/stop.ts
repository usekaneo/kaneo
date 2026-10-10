import { Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";
import { getCurrentUser } from "../../api/endpoints.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { formatDuration } from "../../time/duration.js";
import { entrySeconds } from "../../time/entry-seconds.js";
import {
  findRunningTimer,
  findTaskTimer,
} from "../../time/find-running-timer.js";
import { renderTimerChange } from "../../time/render-timer-change.js";
import { stopTimer } from "../../time/stop-timer.js";
import { toTimeEntryJson } from "../../time/time-entry-json.js";
import { ApiLayer } from "../api-layer.js";

export const runTimeStop = Effect.fn("command.time.stop")(function* (options: {
  readonly task: Option.Option<string>;
}) {
  const user = yield* withSpinner("Checking your account")(getCurrentUser());
  const running = yield* withSpinner("Finding the running timer")(
    Option.match(options.task, {
      onNone: () => findRunningTimer(user.id),
      onSome: (reference) =>
        resolveTask(reference).pipe(
          Effect.flatMap((resolved) => findTaskTimer(resolved, user.id)),
        ),
    }),
  );
  if (Option.isNone(running)) {
    return yield* new InvalidArgument({
      message: Option.isSome(options.task)
        ? `No timer of yours is running on ${options.task.value}.`
        : "No timer is running.",
      hint: Option.isSome(options.task)
        ? "Run kaneo time list to see its entries."
        : "If you started one elsewhere on a task not assigned to you, pass the task: kaneo time stop KAN-12.",
    });
  }
  const timer = running.value;
  const label = timer.task.ticketId ?? timer.task.id.slice(0, 8);
  const now = new Date();
  const stopped = yield* withSpinner(`Stopping ${label}`)(
    stopTimer(timer, now),
  );

  yield* emit(
    {
      ...toTimeEntryJson(stopped, timer.task.ticketId, now, user.name),
      taskTitle: timer.task.title,
      url: timer.task.url,
    },
    (ui) =>
      renderTimerChange(ui, {
        verb: "Stopped",
        label,
        url: timer.task.url,
        details: [formatDuration(entrySeconds(stopped, now))],
      }),
  );
});

export const timeStop = Command.make(
  "stop",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription(
        "Only look on this task (ticket id such as KAN-12, or the task id)",
      ),
      Argument.optional,
    ),
  },
  (options) => runTimeStop(options),
).pipe(
  Command.withDescription("Stop your running timer"),
  Command.provide(ApiLayer),
);
