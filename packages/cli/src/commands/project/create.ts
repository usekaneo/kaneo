import { Effect, Option } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";
import { createProject, updateProject } from "../../api/project-writes.js";
import { describeError } from "../../errors/describe.js";
import { Cancelled, InvalidArgument } from "../../errors/errors.js";
import { readTextInput } from "../../input/read-text-input.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { promptTheme } from "../../prompts/prompt-theme.js";
import { explainKeyConflict } from "../../projects-write/key-conflict.js";
import {
  DEFAULT_PROJECT_ICON,
  matchProjectIcon,
} from "../../projects-write/project-icons.js";
import {
  deriveProjectKey,
  validateProjectKey,
} from "../../projects-write/project-key.js";
import {
  EMPTY_STATISTICS,
  toProjectRecordJson,
} from "../../projects-write/project-record-json.js";
import { renderProjectChange } from "../../projects-write/render-project-change.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

const promptName = Effect.fnUntraced(function* () {
  const output = yield* Output;
  return yield* Prompt.run(
    Prompt.String({
      message: "Project name",
      validate: (value) =>
        value.trim() === ""
          ? Effect.fail("Enter a name")
          : Effect.succeed(value.trim()),
      theme: promptTheme(output.ui),
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});

const resolveName = Effect.fnUntraced(function* (name: Option.Option<string>) {
  const output = yield* Output;
  const given = name.pipe(
    Option.map((value) => value.trim()),
    Option.filter((value) => value !== ""),
  );
  if (Option.isSome(given)) return given.value;
  if (output.interactive) return yield* promptName();
  return yield* new InvalidArgument({
    message: "A project name is required.",
    hint: 'Pass it as the first argument, for example kaneo project create "Kaneo Web".',
  });
});

const resolveKey = (name: string, key: Option.Option<string>) =>
  Option.match(key, {
    onSome: (value) => Effect.fromResult(validateProjectKey(value)),
    onNone: () => {
      const derived = deriveProjectKey(name);
      return derived === ""
        ? Effect.fail(
            new InvalidArgument({
              message: `Could not make a project key from "${name}".`,
              hint: "Pass one with --key, for example --key WEB.",
            }),
          )
        : Effect.fromResult(validateProjectKey(derived));
    },
  });

export const runProjectCreate = Effect.fn("command.project.create")(
  function* (options: {
    readonly name: Option.Option<string>;
    readonly key: Option.Option<string>;
    readonly description: Option.Option<string>;
    readonly descriptionFile: Option.Option<string>;
    readonly icon: Option.Option<string>;
  }) {
    const session = yield* Session;
    const icon = yield* Option.match(options.icon, {
      onNone: () => Effect.succeed(DEFAULT_PROJECT_ICON),
      onSome: (value) => Effect.fromResult(matchProjectIcon(value)),
    });
    const description = yield* readTextInput({
      value: options.description,
      file: options.descriptionFile,
      flag: "--description",
    });
    const workspaceId = yield* resolveWorkspaceId();
    const name = yield* resolveName(options.name);
    const key = yield* resolveKey(name, options.key);

    const created = yield* withSpinner(`Creating ${name}`)(
      createProject({ workspaceId, name, slug: key, icon }),
    ).pipe(
      Effect.catchTag("Conflict", (conflict) =>
        explainKeyConflict(conflict, { workspaceId, name, key }),
      ),
    );

    const text = Option.getOrElse(description, () => "");
    const project =
      text.trim() === ""
        ? created
        : yield* withSpinner("Saving the description")(
            updateProject(created.id, {
              name: created.name,
              icon: created.icon ?? icon,
              slug: created.slug,
              description: text,
              isPublic: created.isPublic ?? false,
            }),
          ).pipe(
            Effect.mapError(
              (error) =>
                new InvalidArgument({
                  message: `Created ${created.name} (${created.slug.toUpperCase()}), but could not save its description: ${describeError(error).message}`,
                  hint: `Set it with kaneo project edit ${created.slug.toUpperCase()} --description-file <path>.`,
                }),
            ),
          );

    yield* emit(
      toProjectRecordJson(project, EMPTY_STATISTICS, session.webUrl),
      (ui, json) =>
        renderProjectChange(ui, {
          verb: "Created",
          name: json.name,
          key: json.key,
          url: json.url,
        }),
    );
  },
);

export const projectCreate = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription(
        "Project name; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    key: Flag.String("key").pipe(
      Flag.withAlias("k"),
      Flag.withDescription(
        "Task id prefix such as KAN (default: made from the name, like the web app)",
      ),
      Flag.optional,
    ),
    description: Flag.String("description").pipe(
      Flag.withAlias("d"),
      Flag.withDescription("Description in Markdown, or - to read stdin"),
      Flag.optional,
    ),
    descriptionFile: Flag.String("description-file").pipe(
      Flag.withAlias("F"),
      Flag.withDescription("Read the description from a file, or - for stdin"),
      Flag.optional,
    ),
    icon: Flag.String("icon").pipe(
      Flag.withDescription(
        "Lucide icon name from the web app, for example Rocket (default: Layout)",
      ),
      Flag.optional,
    ),
  },
  (options) => runProjectCreate(options),
).pipe(
  Command.withDescription("Create a project with the default columns"),
  Command.provide(ApiLayer),
);
