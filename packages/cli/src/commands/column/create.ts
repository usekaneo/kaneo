import { Effect, Option } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";
import { createColumn } from "../../api/columns.js";
import { toColumnJson } from "../../columns/column-json.js";
import { parseColor } from "../../columns/parse-color.js";
import { renderColumnChange } from "../../columns/render-column-change.js";
import { Cancelled, InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { promptTheme } from "../../prompts/prompt-theme.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";
import { projectFlag } from "./project-flag.js";

const askName = Effect.fnUntraced(function* (name: Option.Option<string>) {
  const given = name.pipe(
    Option.map((value) => value.trim()),
    Option.filter((value) => value !== ""),
  );
  if (Option.isSome(given)) return given.value;
  const output = yield* Output;
  if (!output.interactive) {
    return yield* new InvalidArgument({
      message: "A column name is required.",
      hint: 'Pass it as the first argument, for example kaneo column create "QA".',
    });
  }
  return yield* Prompt.run(
    Prompt.String({
      message: "Column name",
      validate: (value) =>
        value.trim() === ""
          ? Effect.fail("Enter a name")
          : Effect.succeed(value.trim()),
      theme: promptTheme(output.ui),
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});

export const runColumnCreate = Effect.fn("command.column.create")(
  function* (options: {
    readonly name: Option.Option<string>;
    readonly project: Option.Option<string>;
    readonly final: boolean;
    readonly icon: Option.Option<string>;
    readonly color: Option.Option<string>;
  }) {
    const color = Option.isSome(options.color)
      ? yield* Effect.fromResult(parseColor(options.color.value))
      : null;
    const icon = Option.getOrUndefined(options.icon)?.trim();
    const name = yield* askName(options.name);
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const created = yield* withSpinner(`Creating ${name}`)(
      createColumn(project.id, {
        name,
        ...(icon ? { icon } : {}),
        ...(color ? { color } : {}),
        ...(options.final ? { isFinal: true } : {}),
      }),
    );

    yield* emit(toColumnJson(created, 0), (ui) =>
      renderColumnChange(ui, {
        verb: "Created",
        column: created,
        details: [
          created.slug,
          created.isFinal ? "final" : "",
          `in ${project.slug.toUpperCase()}`,
        ],
      }),
    );
  },
);

export const columnCreate = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription("Column name; the slug is derived from it"),
      Argument.optional,
    ),
    project: projectFlag,
    final: Flag.Boolean("final").pipe(
      Flag.withDescription(
        "Mark it as a done column, which stops overdue reminders for its tasks",
      ),
      Flag.withDefault(false),
    ),
    icon: Flag.String("icon").pipe(
      Flag.withDescription("Lucide icon name, for example CircleDot"),
      Flag.optional,
    ),
    color: Flag.String("color").pipe(
      Flag.withDescription("Hex color, for example #3b82f6"),
      Flag.optional,
    ),
  },
  (options) => runColumnCreate(options),
).pipe(
  Command.withDescription("Add a column to the end of a project's board"),
  Command.provide(ApiLayer),
);
