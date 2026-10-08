import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { createTaskRelation } from "../../../api/task-relations.js";
import { InvalidArgument } from "../../../errors/errors.js";
import { emit } from "../../../output/emit.js";
import { withSpinner } from "../../../output/spinner.js";
import {
  parseRelationType,
  RELATION_TYPES,
  toApiRelation,
} from "../../../relations/relation-types.js";
import { renderRelationLinked } from "../../../relations/render-relation-change.js";
import { resolvePair } from "../../../relations/resolve-pair.js";
import { taskLabel, taskRef } from "../../../relations/task-ref.js";
import { ApiLayer } from "../../api-layer.js";

export const runRelationAdd = Effect.fn("command.task.relation.add")(
  function* (options: {
    readonly task: string;
    readonly type: string;
    readonly other: string;
  }) {
    const type = yield* Effect.fromResult(parseRelationType(options.type));
    const pair = yield* resolvePair(options.task, options.other);
    const task = taskRef(pair.task);
    const other = taskRef(pair.other);
    const label = taskLabel(task);
    const otherLabel = taskLabel(other);

    const relation = yield* withSpinner(`Linking ${label} and ${otherLabel}`)(
      createTaskRelation(toApiRelation(type, task.id, other.id)),
    ).pipe(
      Effect.catchTag("Conflict", () =>
        Effect.fail(
          new InvalidArgument({
            message: `${label} and ${otherLabel} are already linked this way.`,
            hint: `Run kaneo task relation list ${label} to see how they are linked.`,
          }),
        ),
      ),
    );

    yield* emit(
      {
        id: relation.id,
        type,
        relationType: relation.relationType,
        sourceTaskId: relation.sourceTaskId,
        targetTaskId: relation.targetTaskId,
        task,
        other,
      },
      (ui) =>
        renderRelationLinked(ui, {
          type,
          task: { label, url: task.url },
          other: { label: otherLabel, url: other.url, title: other.title },
        }),
    );
  },
);

export const relationAdd = Command.make(
  "add",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    type: Argument.String("type").pipe(
      Argument.withDescription(
        `How the first task relates to the other: ${RELATION_TYPES.join(", ")}`,
      ),
    ),
    other: Argument.String("other-task").pipe(
      Argument.withDescription("The task to link to"),
    ),
  },
  (options) => runRelationAdd(options),
).pipe(
  Command.withDescription(
    "Link two tasks, for example kaneo task relation add KAN-3 blocked-by KAN-4",
  ),
  Command.provide(ApiLayer),
);
