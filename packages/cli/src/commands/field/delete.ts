import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  deleteCustomField,
  listCustomFields,
} from "../../api/custom-fields.js";
import { chooseField } from "../../fields/choose-field.js";
import { toFieldJson } from "../../fields/field-json.js";
import { renderFieldChange } from "../../fields/render-field-change.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

export const runFieldDelete = Effect.fn("command.field.delete")(
  function* (options: {
    readonly field: Option.Option<string>;
    readonly project: Option.Option<string>;
    readonly yes: boolean;
  }) {
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const fields = (yield* withSpinner("Loading fields")(
      listCustomFields(project.id),
    )).map(toFieldJson);
    const field = yield* chooseField(fields, options.field, {
      projectName: project.name,
      question: "Delete which field?",
      example: 'kaneo field delete "Story points"',
    });

    yield* confirmDestructive({
      yes: options.yes,
      action: `Deleting the field ${field.name}`,
      question: `Delete the field ${field.name} from ${project.name}? Its values on every task are deleted too. This cannot be undone.`,
    });

    yield* withSpinner(`Deleting ${field.name}`)(deleteCustomField(field.id));
    yield* emit({ id: field.id, name: field.name, deleted: true }, (ui) =>
      renderFieldChange(ui, {
        verb: "Deleted",
        name: field.name,
        type: field.type,
      }),
    );
  },
);

export const fieldDelete = Command.make(
  "delete",
  {
    field: Argument.String("field").pipe(
      Argument.withDescription(
        "Field name or id; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runFieldDelete(options),
).pipe(
  Command.withDescription("Delete a custom field and its values on every task"),
  Command.provide(ApiLayer),
);
