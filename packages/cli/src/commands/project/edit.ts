import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { getProjectRecord, updateProject } from "../../api/project-writes.js";
import { readTextInput } from "../../input/read-text-input.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { explainKeyConflict } from "../../projects-write/key-conflict.js";
import {
  buildProjectUpdate,
  describeEdits,
  parseProjectEdits,
} from "../../projects-write/project-edits.js";
import { toProjectRecordJson } from "../../projects-write/project-record-json.js";
import { renderProjectChange } from "../../projects-write/render-project-change.js";
import { resolveProjectRecord } from "../../projects-write/resolve-project-record.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

export const runProjectEdit = Effect.fn("command.project.edit")(
  function* (options: {
    readonly project: Option.Option<string>;
    readonly name: Option.Option<string>;
    readonly key: Option.Option<string>;
    readonly description: Option.Option<string>;
    readonly descriptionFile: Option.Option<string>;
    readonly icon: Option.Option<string>;
    readonly public: boolean;
    readonly private: boolean;
  }) {
    const session = yield* Session;
    const description = yield* readTextInput({
      value: options.description,
      file: options.descriptionFile,
      flag: "--description",
    });
    const edits = yield* Effect.fromResult(
      parseProjectEdits({
        name: options.name,
        key: options.key,
        description,
        icon: options.icon,
        public: options.public,
        private: options.private,
      }),
    );
    const workspaceId = yield* resolveWorkspaceId();
    const target = yield* resolveProjectRecord({
      workspaceId,
      reference: options.project,
      scope: "any",
      useContext: true,
      prompt: "Choose a project to edit",
      missing: "Which project should be changed?",
      example: "kaneo project edit KAN --name Web",
    });
    const current = yield* withSpinner(`Loading ${target.name}`)(
      getProjectRecord(target.id),
    );
    const body = buildProjectUpdate(current, edits);
    const updated = yield* withSpinner(`Updating ${current.name}`)(
      updateProject(current.id, body),
    ).pipe(
      Effect.catchTag("Conflict", (conflict) =>
        explainKeyConflict(conflict, {
          workspaceId,
          name: body.name,
          key: body.slug,
        }),
      ),
    );

    yield* emit(
      toProjectRecordJson(updated, target.statistics, session.webUrl),
      (ui, json) =>
        renderProjectChange(ui, {
          verb: "Updated",
          name: json.name,
          key: json.key,
          url: json.url,
          detail: describeEdits(edits),
        }),
    );
  },
);

export const projectEdit = Command.make(
  "edit",
  {
    project: Argument.String("project").pipe(
      Argument.withDescription(
        "Project key or id, for example KAN (default: the linked project)",
      ),
      Argument.optional,
    ),
    name: Flag.String("name").pipe(
      Flag.withDescription("New name"),
      Flag.optional,
    ),
    key: Flag.String("key").pipe(
      Flag.withAlias("k"),
      Flag.withDescription(
        "New task id prefix; existing ticket ids change with it",
      ),
      Flag.optional,
    ),
    description: Flag.String("description").pipe(
      Flag.withAlias("d"),
      Flag.withDescription(
        "New description in Markdown, or - to read stdin; replaces the current one",
      ),
      Flag.optional,
    ),
    descriptionFile: Flag.String("description-file").pipe(
      Flag.withAlias("F"),
      Flag.withDescription("Read the description from a file, or - for stdin"),
      Flag.optional,
    ),
    icon: Flag.String("icon").pipe(
      Flag.withDescription(
        "Lucide icon name from the web app, for example Rocket",
      ),
      Flag.optional,
    ),
    public: Flag.Boolean("public").pipe(
      Flag.withDescription("Let anyone with the link view the board"),
      Flag.withDefault(false),
    ),
    private: Flag.Boolean("private").pipe(
      Flag.withDescription("Only workspace members can view the board"),
      Flag.withDefault(false),
    ),
  },
  (options) => runProjectEdit(options),
).pipe(
  Command.withDescription(
    "Change a project's name, key, description, icon or visibility",
  ),
  Command.provide(ApiLayer),
);
