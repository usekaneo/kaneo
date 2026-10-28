import { writeFile } from "node:fs/promises";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { exportTasks } from "../../api/export-import.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { projectUrl } from "../../render/links.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { renderExported } from "../../transfer/render-exported.js";
import { ApiLayer } from "../api-layer.js";

export const runTaskExport = Effect.fn("command.task.export")(
  function* (options: {
    readonly project: Option.Option<string>;
    readonly output: Option.Option<string>;
  }) {
    const session = yield* Session;
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const document = yield* withSpinner(`Exporting ${project.name}`)(
      exportTasks(project.id),
    );
    const file = Option.filter(options.output, (path) => path !== "-");
    if (Option.isNone(file)) {
      return yield* emit(document, (_ui, value) =>
        JSON.stringify(value, null, 2).split("\n"),
      );
    }
    const path = file.value;
    yield* Effect.tryPromise({
      try: () => writeFile(path, `${JSON.stringify(document, null, 2)}\n`),
      catch: () =>
        new InvalidArgument({
          message: `Could not write ${path}.`,
          hint: "Check that the folder exists and is writable.",
        }),
    });
    yield* emit(
      {
        file: path,
        tasks: document.tasks.length,
        exportedAt: document.project.exportedAt,
        project: {
          id: project.id,
          key: project.slug.toUpperCase(),
          name: project.name,
          url: projectUrl(session.webUrl, project),
        },
      },
      renderExported,
    );
  },
);

export const taskExport = Command.make(
  "export",
  {
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
    output: Flag.String("output").pipe(
      Flag.withAlias("o"),
      Flag.withDescription("Write the JSON to this file instead of stdout"),
      Flag.optional,
    ),
  },
  (options) => runTaskExport(options),
).pipe(
  Command.withDescription(
    "Export a project's tasks as JSON, ready for kaneo task import",
  ),
  Command.provide(ApiLayer),
);
