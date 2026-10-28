import { Effect, Option } from "effect";
import { Command } from "effect/cli";
import { getCurrentUser } from "../../api/endpoints.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { entrySeconds } from "../../time/entry-seconds.js";
import { findRunningTimer } from "../../time/find-running-timer.js";
import { renderTimerStatus } from "../../time/render-timer-status.js";
import { toTimeEntryJson } from "../../time/time-entry-json.js";
import { ApiLayer } from "../api-layer.js";

export const runTimeStatus = Effect.fn("command.time.status")(function* () {
  const running = yield* withSpinner("Checking for a running timer")(
    Effect.gen(function* () {
      const user = yield* getCurrentUser();
      const timer = yield* findRunningTimer(user.id);
      return Option.map(timer, (value) => ({ ...value, user }));
    }),
  );
  const now = new Date();

  yield* emit(
    Option.match(running, {
      onNone: () => null,
      onSome: ({ entry, task, user }) => ({
        ...toTimeEntryJson(entry, task.ticketId, now, user.name),
        taskTitle: task.title,
        url: task.url,
      }),
    }),
    (ui) =>
      renderTimerStatus(
        ui,
        Option.match(running, {
          onNone: () => null,
          onSome: ({ entry, task }) => ({
            label: task.ticketId ?? task.id.slice(0, 8),
            url: task.url,
            title: task.title,
            startedAt: entry.startTime,
            elapsedSeconds: entrySeconds(entry, now),
            note: entry.description?.trim() ? entry.description : null,
          }),
        }),
      ),
  );
});

export const timeStatus = Command.make("status", {}, () =>
  runTimeStatus(),
).pipe(
  Command.withDescription("Show your running timer"),
  Command.provide(ApiLayer),
);
