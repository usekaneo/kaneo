import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listWorkspaceLabels, updateLabel } from "../../api/labels.js";
import { InvalidArgument } from "../../errors/errors.js";
import { chooseLabel } from "../../labels/choose-label.js";
import { labelColorName, parseLabelColor } from "../../labels/label-colors.js";
import { toLabelJson } from "../../labels/label-json.js";
import {
  findNameClash,
  quoteName,
  workspaceLabels,
} from "../../labels/match-label.js";
import { nameClashError } from "../../labels/name-clash-error.js";
import { renderLabelChange } from "../../labels/render-label-change.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

export const runLabelEdit = Effect.fn("command.label.edit")(
  function* (options: {
    readonly label: Option.Option<string>;
    readonly name: Option.Option<string>;
    readonly color: Option.Option<string>;
  }) {
    if (Option.isNone(options.name) && Option.isNone(options.color)) {
      return yield* new InvalidArgument({
        message: "Nothing to change.",
        hint: "Pass --name, --color, or both.",
      });
    }
    const newName = Option.map(options.name, (value) => value.trim());
    if (Option.isSome(newName) && newName.value === "") {
      return yield* new InvalidArgument({
        message: "The label name cannot be empty.",
        hint: "Pass a name, for example --name Bug.",
      });
    }
    const newColor = yield* Option.match(options.color, {
      onNone: () => Effect.succeed(Option.none<string>()),
      onSome: (value) =>
        Effect.fromResult(parseLabelColor(value)).pipe(Effect.map(Option.some)),
    });

    const workspaceId = yield* resolveWorkspaceId();
    const labels = yield* withSpinner("Loading labels")(
      listWorkspaceLabels(workspaceId),
    );
    const target = yield* chooseLabel(
      workspaceLabels(labels),
      options.label,
      "kaneo label edit Bug --color crimson",
    );
    if (target.deletionStartedAt) {
      return yield* new InvalidArgument({
        message: `The label "${target.name}" is being deleted.`,
        hint: `Run kaneo label delete ${quoteName(target.name)} to finish deleting it.`,
      });
    }
    const name = Option.getOrElse(newName, () => target.name);
    const color = Option.getOrElse(newColor, () => target.color);
    const renamed = name !== target.name;
    if (renamed) {
      const clash = findNameClash(labels, name, target);
      if (clash) return yield* nameClashError(clash, name, target.name);
    }

    const updated = yield* withSpinner(`Updating ${target.name}`)(
      updateLabel(target.id, { name, color }),
    ).pipe(
      Effect.catchTag("ServerError", (error) =>
        Effect.fail<InvalidArgument | typeof error>(
          renamed && error.status === 500
            ? new InvalidArgument({
                message: `Could not rename "${target.name}" to "${name}".`,
                hint: `A task you cannot see may already have a label named "${name}". Pick another name.`,
              })
            : error,
        ),
      ),
    );

    const changes = [
      ...(renamed ? [`renamed from ${target.name}`] : []),
      ...(color !== target.color
        ? [`color ${labelColorName(color) ?? color}`]
        : []),
    ];
    yield* emit(toLabelJson(updated), (ui, label) =>
      renderLabelChange(ui, {
        verb: "Updated",
        name: label.name,
        color: label.color,
        detail: changes.length > 0 ? changes.join(", ") : "no changes",
      }),
    );
  },
);

export const labelEdit = Command.make(
  "edit",
  {
    label: Argument.String("label").pipe(
      Argument.withDescription(
        "Label name or id; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    name: Flag.String("name").pipe(
      Flag.withDescription("New name"),
      Flag.optional,
    ),
    color: Flag.String("color").pipe(
      Flag.withAlias("c"),
      Flag.withDescription(
        "New color: a hex color such as #e7000b, or a palette name such as crimson",
      ),
      Flag.optional,
    ),
  },
  (options) => runLabelEdit(options),
).pipe(
  Command.withDescription(
    "Rename a workspace label or change its color, on every task that uses it",
  ),
  Command.provide(ApiLayer),
);
