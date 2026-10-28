import { Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { listCustomFields } from "../../api/custom-fields.js";
import { toFieldJson } from "../../fields/field-json.js";
import { renderFieldList } from "../../fields/render-field-list.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

export const runFieldList = Effect.fn("command.field.list")(
  function* (options: { readonly project: Option.Option<string> }) {
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const fields = yield* withSpinner("Loading fields")(
      listCustomFields(project.id),
    );
    yield* emit(fields.map(toFieldJson), (ui, value) =>
      renderFieldList(ui, { projectName: project.name, fields: value }),
    );
  },
);

export const fieldList = Command.make(
  "list",
  {
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
  },
  (options) => runFieldList(options),
).pipe(
  Command.withDescription("List the custom fields of a project"),
  Command.provide(ApiLayer),
);
