import { Effect, Option } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";
import {
  createCustomField,
  listCustomFields,
} from "../../api/custom-fields.js";
import { Cancelled, InvalidArgument } from "../../errors/errors.js";
import { toFieldJson } from "../../fields/field-json.js";
import {
  checkFieldOptions,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  parseFieldType,
} from "../../fields/field-types.js";
import { renderFieldChange } from "../../fields/render-field-change.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { pick } from "../../prompts/pick.js";
import { promptTheme } from "../../prompts/prompt-theme.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
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
        message: "Field name",
        validate: (value) =>
          value.trim() === ""
            ? Effect.fail("Enter a name")
            : Effect.succeed(value.trim()),
        theme: promptTheme(output.ui),
      }),
    ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
  }
  return yield* new InvalidArgument({
    message: "A field name is required.",
    hint: 'Pass it as the first argument, for example kaneo field create "Story points" --type number.',
  });
});

const resolveType = Effect.fnUntraced(function* (type: Option.Option<string>) {
  const output = yield* Output;
  if (Option.isSome(type)) {
    return yield* Effect.fromResult(parseFieldType(type.value));
  }
  if (output.interactive) {
    return yield* pick(
      "Field type",
      FIELD_TYPES.map((value) => ({
        title: FIELD_TYPE_LABELS[value],
        value,
        description: value,
      })),
    );
  }
  return yield* new InvalidArgument({
    message: "A field type is required.",
    hint: `Pass --type with one of: ${FIELD_TYPES.join(", ")}.`,
  });
});

export const runFieldCreate = Effect.fn("command.field.create")(
  function* (options: {
    readonly name: Option.Option<string>;
    readonly type: Option.Option<string>;
    readonly options: ReadonlyArray<string>;
    readonly project: Option.Option<string>;
  }) {
    const name = yield* resolveName(options.name);
    const type = yield* resolveType(options.type);
    const choices = yield* Effect.fromResult(
      checkFieldOptions(type, options.options),
    );
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const existing = (yield* withSpinner("Loading fields")(
      listCustomFields(project.id),
    )).map(toFieldJson);
    const clash = existing.find(
      (field) => field.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) {
      return yield* new InvalidArgument({
        message: `${project.name} already has a field named ${clash.name}.`,
        hint: "Choose another name. Fields cannot be renamed, so delete the old one first if you want to replace it.",
      });
    }
    const created = yield* withSpinner(`Creating ${name}`)(
      createCustomField({
        projectId: project.id,
        name,
        type,
        ...(choices ? { options: choices } : {}),
      }),
    );
    yield* emit(toFieldJson(created), (ui, field) =>
      renderFieldChange(ui, {
        verb: "Created",
        name: field.name,
        type: field.type,
      }),
    );
  },
);

export const fieldCreate = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription(
        "Field name; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    type: Flag.String("type").pipe(
      Flag.withAlias("t"),
      Flag.withDescription(
        "text, number, date, dropdown (or select), multiselect, or boolean",
      ),
      Flag.optional,
    ),
    options: Flag.String("option").pipe(
      Flag.withAlias("o"),
      Flag.withDescription(
        "A choice for dropdown and multiselect fields; repeat for each choice",
      ),
      Flag.atLeast(0),
    ),
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
  },
  (options) => runFieldCreate(options),
).pipe(
  Command.withDescription("Add a custom field to a project"),
  Command.provide(ApiLayer),
);
