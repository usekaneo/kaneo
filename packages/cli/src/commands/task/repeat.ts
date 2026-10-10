import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import type { TaskRecurrence } from "../../api/schemas.js";
import { updateTaskRecurrence } from "../../api/task-mutations.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { pick } from "../../prompts/pick.js";
import {
  buildRecurrence,
  FREQUENCIES,
  type Frequency,
  localTimeZone,
} from "../../tasks/build-recurrence.js";
import { formatRecurrence } from "../../tasks/format-recurrence.js";
import { renderTaskChange } from "../../tasks/render-task-change.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

const RULE_HINT = "Use daily, weekly, monthly or yearly, or pass --stop.";

export const runTaskRepeat = Effect.fn("command.task.repeat")(
  function* (options: {
    readonly task: string;
    readonly frequency: Option.Option<Frequency>;
    readonly every: Option.Option<number>;
    readonly on: ReadonlyArray<string>;
    readonly timeZone: Option.Option<string>;
    readonly stop: boolean;
  }) {
    const output = yield* Output;
    const ruleFlags =
      Option.isSome(options.frequency) ||
      Option.isSome(options.every) ||
      Option.isSome(options.timeZone) ||
      options.on.length > 0;
    if (options.stop && ruleFlags) {
      return yield* new InvalidArgument({
        message: "Pass a repeat rule or --stop, not both.",
        hint: RULE_HINT,
      });
    }
    const resolved = yield* withSpinner(`Loading ${options.task.trim()}`)(
      resolveTask(options.task),
    );
    const label = resolved.ticketId ?? resolved.task.id.slice(0, 8);
    const current = resolved.task.recurrence ?? null;

    const frequency: Frequency | null = options.stop
      ? null
      : yield* Option.match(options.frequency, {
          onSome: Effect.succeed,
          onNone: () =>
            output.interactive
              ? pick<Frequency | null>(`Repeat ${label}`, [
                  ...FREQUENCIES.map((value) => ({
                    title: formatRecurrence({ frequency: value, interval: 1 }),
                    value,
                    description:
                      current?.frequency === value ? "current" : undefined,
                  })),
                  ...(current
                    ? [{ title: "Stop repeating", value: null }]
                    : []),
                ])
              : Effect.fail(
                  new InvalidArgument({
                    message: `Pass how often ${label} repeats.`,
                    hint: RULE_HINT,
                  }),
                ),
        });

    const recurrence: TaskRecurrence | null =
      frequency === null
        ? null
        : yield* Effect.fromResult(
            buildRecurrence({
              frequency,
              every: Option.getOrElse(options.every, () => 1),
              on: options.on,
              timeZone: Option.getOrElse(options.timeZone, localTimeZone),
            }),
          );

    yield* withSpinner(`Updating ${label}`)(
      updateTaskRecurrence(resolved.task.id, recurrence),
    ).pipe(
      Effect.catchTag("Conflict", () =>
        Effect.fail(
          new InvalidArgument({
            message: `${label} is done, so it cannot start repeating.`,
            hint: `Move it back to an open column with kaneo task status ${label}, or set the rule on its next task.`,
          }),
        ),
      ),
    );

    const rule = recurrence ? formatRecurrence(recurrence) : null;
    yield* emit(
      {
        id: resolved.task.id,
        ticketId: resolved.ticketId,
        recurrence,
        url: resolved.url,
      },
      (ui) =>
        renderTaskChange(ui, {
          verb: "Updated",
          reference: label,
          url: resolved.url,
          detail: rule
            ? `repeats ${rule.charAt(0).toLowerCase()}${rule.slice(1)}`
            : "stopped repeating",
        }),
    );
  },
);

export const taskRepeat = Command.make(
  "repeat",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    frequency: Argument.Literals("frequency", FREQUENCIES).pipe(
      Argument.withDescription("How often the task repeats"),
      Argument.optional,
    ),
    every: Flag.Int("every").pipe(
      Flag.withDescription(
        "Repeat every this many days, weeks, months or years, from 1 to 99",
      ),
      Flag.optional,
    ),
    on: Flag.String("on").pipe(
      Flag.withDescription(
        "Weekly only: days to repeat on, such as mon,thu; defaults to the due date's weekday",
      ),
      Flag.atLeast(0),
    ),
    timeZone: Flag.String("time-zone").pipe(
      Flag.withDescription(
        "IANA time zone that keeps dates on the same local day; defaults to this computer's",
      ),
      Flag.optional,
    ),
    stop: Flag.Boolean("stop").pipe(
      Flag.withDescription("Stop the task repeating"),
      Flag.withDefault(false),
    ),
  },
  (options) => runTaskRepeat(options),
).pipe(
  Command.withDescription(
    "Make a task repeat when it is done, or stop it repeating",
  ),
  Command.provide(ApiLayer),
);
