import { Effect, Option } from "effect";
import { createTaskRelation } from "../api/task-relations.js";
import { describeError } from "../errors/describe.js";
import { InvalidArgument } from "../errors/errors.js";
import { withSpinner } from "../output/spinner.js";
import { type ResolvedTask, resolveTask } from "../tasks/resolve-task.js";
import { toApiRelation } from "./relation-types.js";
import { type TaskRef, taskArgument, taskLabel, taskRef } from "./task-ref.js";

export const resolveParent = Effect.fn("relations.resolveParent")(function* (
  reference: Option.Option<string>,
  workspaceId: string,
) {
  if (Option.isNone(reference)) return undefined;
  const parent = yield* withSpinner(`Loading ${reference.value}`)(
    resolveTask(reference.value),
  );
  if (parent.workspaceId !== workspaceId) {
    return yield* new InvalidArgument({
      message: `${taskLabel(taskRef(parent))} is in another workspace.`,
      hint: "A subtask must be in the same workspace as its parent. Pass -w with the parent's workspace.",
    });
  }
  return parent;
});

export function projectOrParent(
  project: Option.Option<string>,
  parent: ResolvedTask | undefined,
): Option.Option<string> {
  return Option.isSome(project) || !parent
    ? project
    : Option.some(parent.project.id);
}

export const linkToParent = Effect.fn("relations.linkToParent")(function* (
  parent: ResolvedTask | undefined,
  child: {
    readonly id: string;
    readonly label: string;
    readonly argument: string;
  },
) {
  if (!parent) return null;
  const ref: TaskRef = taskRef(parent);
  const parentLabel = taskLabel(ref);
  yield* withSpinner(`Linking to ${parentLabel}`)(
    createTaskRelation(toApiRelation("subtask-of", child.id, parent.task.id)),
  ).pipe(
    Effect.mapError(
      (error) =>
        new InvalidArgument({
          message: `Created ${child.label}, but could not make it a subtask of ${parentLabel}: ${describeError(error).message}`,
          hint: `Link it with kaneo task relation add ${child.argument} subtask-of ${taskArgument(ref)}`,
        }),
    ),
  );
  return ref;
});
