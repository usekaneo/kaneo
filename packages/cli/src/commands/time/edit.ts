import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { getCurrentUser } from "../../api/endpoints.js";
import { getTimeEntry, updateTimeEntry } from "../../api/time-entries.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { formatDuration, parseDuration } from "../../time/duration.js";
import { entrySeconds } from "../../time/entry-seconds.js";
import { taskRef } from "../../time/find-running-timer.js";
import { renderTimerChange } from "../../time/render-timer-change.js";
import { toTimeEntryJson } from "../../time/time-entry-json.js";
import { ApiLayer } from "../api-layer.js";
import { noteFlag } from "./note-flag.js";

export const runTimeEdit = Effect.fn("command.time.edit")(function* (options: {
  readonly entry: string;
  readonly duration: Option.Option<string>;
  readonly note: Option.Option<string>;
}) {
  if (Option.isNone(options.duration) && Option.isNone(options.note)) {
    return yield* new InvalidArgument({
      message: "Nothing to change.",
      hint: "Pass --duration, -m, or both.",
    });
  }
  const seconds = Option.isSome(options.duration)
    ? yield* Effect.fromResult(
        parseDuration(options.duration.value, "--duration"),
      )
    : undefined;
  const id = options.entry.trim();
  const entry = yield* withSpinner("Loading the entry")(getTimeEntry(id));
  if (seconds !== undefined && entry.endTime === null) {
    return yield* new InvalidArgument({
      message: "This entry is still running.",
      hint: "Stop it with kaneo time stop, then set its duration.",
    });
  }
  const description = Option.getOrUndefined(options.note)?.trim();

  const { updated, resolved, user } = yield* withSpinner("Updating the entry")(
    Effect.all(
      {
        updated: updateTimeEntry(entry.id, {
          startTime: entry.startTime,
          ...(seconds === undefined
            ? {}
            : {
                endTime: new Date(
                  Date.parse(entry.startTime) + seconds * 1000,
                ).toISOString(),
              }),
          ...(description === undefined ? {} : { description }),
        }),
        resolved: resolveTask(entry.taskId),
        user: getCurrentUser(),
      },
      { concurrency: 3 },
    ),
  );
  const task = taskRef(resolved);
  const now = new Date();
  const json = toTimeEntryJson(
    updated,
    task.ticketId,
    now,
    updated.userId === user.id ? user.name : null,
  );

  yield* emit({ ...json, taskTitle: task.title, url: task.url }, (ui) =>
    renderTimerChange(ui, {
      verb: "Updated",
      label: task.ticketId ?? task.id.slice(0, 8),
      url: task.url,
      details: [
        updated.endTime === null
          ? "still running"
          : formatDuration(entrySeconds(updated, now)),
        json.note ?? "",
      ],
    }),
  );
});

export const timeEdit = Command.make(
  "edit",
  {
    entry: Argument.String("entry-id").pipe(
      Argument.withDescription("Time entry id, from kaneo time list"),
    ),
    duration: Flag.String("duration").pipe(
      Flag.withAlias("d"),
      Flag.withDescription(
        "New length, for example 1h30m; keeps the start time",
      ),
      Flag.optional,
    ),
    note: noteFlag,
  },
  (options) => runTimeEdit(options),
).pipe(
  Command.withDescription("Change the length or note of a time entry"),
  Command.provide(ApiLayer),
);
