import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listWorkspaceLabels } from "../../api/labels.js";
import { InvalidArgument } from "../../errors/errors.js";
import { chooseLabel } from "../../labels/choose-label.js";
import { deleteLabelFully } from "../../labels/delete-label-fully.js";
import {
  labelUsage,
  quoteName,
  workspaceLabels,
} from "../../labels/match-label.js";
import { renderLabelChange } from "../../labels/render-label-change.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

function taskCount(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}

export const runLabelDelete = Effect.fn("command.label.delete")(
  function* (options: {
    readonly label: Option.Option<string>;
    readonly yes: boolean;
  }) {
    const workspaceId = yield* resolveWorkspaceId();
    const labels = yield* withSpinner("Loading labels")(
      listWorkspaceLabels(workspaceId),
    );
    const target = yield* chooseLabel(
      workspaceLabels(labels),
      options.label,
      "kaneo label delete Bug",
    );
    const used = labelUsage(labels).get(target.name) ?? 0;

    yield* confirmDestructive({
      yes: options.yes,
      action: `Deleting the label ${target.name}`,
      question:
        used > 0
          ? `Delete the label ${target.name} and remove it from ${taskCount(used)}? This cannot be undone.`
          : `Delete the label ${target.name}? This cannot be undone.`,
    });

    yield* withSpinner(`Deleting ${target.name}`)(
      deleteLabelFully(target.id),
    ).pipe(
      Effect.catchTag("RateLimited", () =>
        Effect.fail(
          new InvalidArgument({
            message: `The server is still busy deleting labels, so ${target.name} is only partly deleted.`,
            hint: `Progress is saved. Run kaneo label delete ${quoteName(target.name)} --yes again in a minute to finish.`,
          }),
        ),
      ),
    );

    yield* emit({ id: target.id, name: target.name, deleted: true }, (ui) =>
      renderLabelChange(ui, {
        verb: "Deleted",
        name: target.name,
        color: target.color,
        ...(used > 0 ? { detail: `removed from ${taskCount(used)}` } : {}),
      }),
    );
  },
);

export const labelDelete = Command.make(
  "delete",
  {
    label: Argument.String("label").pipe(
      Argument.withDescription(
        "Label name or id; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runLabelDelete(options),
).pipe(
  Command.withDescription(
    "Delete a workspace label and remove it from every task",
  ),
  Command.provide(ApiLayer),
);
