import { Effect } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { withSpinner } from "../output/spinner.js";
import { resolveTask } from "../tasks/resolve-task.js";
import { taskLabel, taskRef } from "./task-ref.js";

export const resolvePair = Effect.fn("relations.resolvePair")(function* (
  taskReference: string,
  otherReference: string,
) {
  const [task, other] = yield* withSpinner(
    `Loading ${taskReference} and ${otherReference}`,
  )(
    Effect.all([resolveTask(taskReference), resolveTask(otherReference)], {
      concurrency: 2,
    }),
  );
  if (task.task.id === other.task.id) {
    return yield* new InvalidArgument({
      message: `${taskLabel(taskRef(task))} cannot be linked to itself.`,
    });
  }
  if (task.workspaceId !== other.workspaceId) {
    return yield* new InvalidArgument({
      message: `${taskLabel(taskRef(other))} is in another workspace than ${taskLabel(taskRef(task))}.`,
      hint: "Tasks can only be linked within one workspace.",
    });
  }
  return { task, other };
});
