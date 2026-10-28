import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { Desktop } from "../../services/desktop.js";
import {
  type OpenTaskResult,
  renderOpenTask,
} from "../../tasks/render-open-task.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

export const runTaskOpen = Effect.fn("command.task.open")(function* (
  reference: string,
) {
  const output = yield* Output;
  const desktop = yield* Desktop;
  const { url } = yield* withSpinner(`Finding ${reference.trim()}`)(
    resolveTask(reference),
  );
  const opened =
    output.mode === "human" && output.interactive
      ? yield* desktop.openUrl(url)
      : false;
  yield* emit<OpenTaskResult>({ url, opened }, renderOpenTask);
});

export const taskOpen = Command.make(
  "open",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or a task id"),
    ),
  },
  ({ task }) => runTaskOpen(task),
).pipe(
  Command.withDescription("Open a task in your browser"),
  Command.provide(ApiLayer),
);
