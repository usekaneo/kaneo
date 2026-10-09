import { Effect, Option } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";
import { createLabel, listWorkspaceLabels } from "../../api/labels.js";
import { Cancelled, InvalidArgument } from "../../errors/errors.js";
import {
  defaultLabelColor,
  parseLabelColor,
} from "../../labels/label-colors.js";
import { toLabelJson } from "../../labels/label-json.js";
import { findNameClash, workspaceLabels } from "../../labels/match-label.js";
import { nameClashError } from "../../labels/name-clash-error.js";
import { renderLabelChange } from "../../labels/render-label-change.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { promptTheme } from "../../prompts/prompt-theme.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

const resolveName = Effect.fnUntraced(function* (name: Option.Option<string>) {
  const output = yield* Output;
  const given = name.pipe(
    Option.map((value) => value.trim()),
    Option.filter((value) => value !== ""),
  );
  if (Option.isSome(given)) return given.value;
  if (output.interactive) {
    return yield* Prompt.run(
      Prompt.String({
        message: "Label name",
        validate: (value) =>
          value.trim() === ""
            ? Effect.fail("Enter a name")
            : Effect.succeed(value.trim()),
        theme: promptTheme(output.ui),
      }),
    ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
  }
  return yield* new InvalidArgument({
    message: "A label name is required.",
    hint: "Pass it as the first argument, for example kaneo label create Bug.",
  });
});

export const runLabelCreate = Effect.fn("command.label.create")(
  function* (options: {
    readonly name: Option.Option<string>;
    readonly color: Option.Option<string>;
  }) {
    const color = yield* Option.match(options.color, {
      onNone: () => Effect.succeed(undefined),
      onSome: (value) => Effect.fromResult(parseLabelColor(value)),
    });
    const workspaceId = yield* resolveWorkspaceId();
    const name = yield* resolveName(options.name);
    const labels = yield* withSpinner("Loading labels")(
      listWorkspaceLabels(workspaceId),
    );
    const clash = findNameClash(labels, name);
    if (clash) return yield* nameClashError(clash, name);
    const created = yield* withSpinner(`Creating ${name}`)(
      createLabel({
        workspaceId,
        name,
        color:
          color ??
          defaultLabelColor(
            name,
            workspaceLabels(labels).map((label) => label.color),
          ),
      }),
    );
    yield* emit(toLabelJson(created), (ui, label) =>
      renderLabelChange(ui, {
        verb: "Created",
        name: label.name,
        color: label.color,
      }),
    );
  },
);

export const labelCreate = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription(
        "Label name; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    color: Flag.String("color").pipe(
      Flag.withAlias("c"),
      Flag.withDescription(
        "Hex color such as #e7000b, or stone, slate, lavender, sage, forest, amber, terracotta, rose or crimson (default: an unused one)",
      ),
      Flag.optional,
    ),
  },
  (options) => runLabelCreate(options),
).pipe(
  Command.withDescription("Create a workspace label"),
  Command.provide(ApiLayer),
);
