import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  deleteTaskRelation,
  listTaskRelations,
} from "../../../api/task-relations.js";
import { NotFound } from "../../../errors/errors.js";
import { emit } from "../../../output/emit.js";
import { withSpinner } from "../../../output/spinner.js";
import { confirmDestructive } from "../../../prompts/confirm-destructive.js";
import { relationsBetween } from "../../../relations/group-relations.js";
import {
  notLinkedPhrase,
  parseRelationType,
  perspectiveOf,
  RELATION_TYPES,
} from "../../../relations/relation-types.js";
import { renderRelationsRemoved } from "../../../relations/render-relation-change.js";
import { resolvePair } from "../../../relations/resolve-pair.js";
import { taskLabel, taskRef } from "../../../relations/task-ref.js";
import { ApiLayer } from "../../api-layer.js";

export const runRelationRemove = Effect.fn("command.task.relation.remove")(
  function* (options: {
    readonly task: string;
    readonly other: string;
    readonly type: Option.Option<string>;
    readonly yes: boolean;
  }) {
    const type = Option.isSome(options.type)
      ? yield* Effect.fromResult(parseRelationType(options.type.value))
      : undefined;
    const pair = yield* resolvePair(options.task, options.other);
    const task = taskRef(pair.task);
    const other = taskRef(pair.other);
    const label = taskLabel(task);
    const otherLabel = taskLabel(other);

    const relations = yield* withSpinner(`Loading relations of ${label}`)(
      listTaskRelations(task.id),
    );
    const matches = relationsBetween(relations, task.id, other.id, type).map(
      (relation) => ({
        id: relation.id,
        type: perspectiveOf(relation, task.id).type,
      }),
    );
    if (matches.length === 0) {
      return yield* new NotFound({
        message: type
          ? `${label} ${notLinkedPhrase(type)} ${otherLabel}.`
          : `${label} and ${otherLabel} are not linked.`,
      });
    }
    if (matches.length > 1) {
      yield* confirmDestructive({
        yes: options.yes,
        action: `Removing ${matches.length} relations`,
        question: `Remove ${matches.length} relations between ${label} and ${otherLabel} (${matches.map((match) => match.type).join(", ")})?`,
      });
    }

    yield* withSpinner(`Unlinking ${label} and ${otherLabel}`)(
      Effect.forEach(matches, (match) => deleteTaskRelation(match.id), {
        discard: true,
      }),
    );

    yield* emit({ task, other, removed: matches }, (ui) =>
      renderRelationsRemoved(ui, {
        types: matches.map((match) => match.type),
        task: { label, url: task.url },
        other: { label: otherLabel, url: other.url },
      }),
    );
  },
);

export const relationRemove = Command.make(
  "remove",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    other: Argument.String("other-task").pipe(
      Argument.withDescription("The linked task"),
    ),
    type: Flag.String("type").pipe(
      Flag.withAlias("t"),
      Flag.withDescription(
        `Remove only this relation: ${RELATION_TYPES.join(", ")}`,
      ),
      Flag.optional,
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription(
        "Remove several relations without asking for confirmation",
      ),
      Flag.withDefault(false),
    ),
  },
  (options) => runRelationRemove(options),
).pipe(Command.withDescription("Unlink two tasks"), Command.provide(ApiLayer));
