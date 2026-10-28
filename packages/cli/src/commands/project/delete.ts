import { Effect, type Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { deleteProject } from "../../api/project-writes.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmByKey } from "../../projects-write/confirm-by-key.js";
import { toProjectRecordJson } from "../../projects-write/project-record-json.js";
import { renderProjectChange } from "../../projects-write/render-project-change.js";
import { resolveProjectRecord } from "../../projects-write/resolve-project-record.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

function taskCount(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}

function contents(count: number): string {
  return count === 0
    ? "and its columns"
    : `with its ${taskCount(count)}, their comments and time entries, and its columns`;
}

export const runProjectDelete = Effect.fn("command.project.delete")(
  function* (options: {
    readonly project: Option.Option<string>;
    readonly yes: boolean;
  }) {
    const session = yield* Session;
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProjectRecord({
      workspaceId,
      reference: options.project,
      scope: "any",
      useContext: false,
      prompt: "Choose a project to delete",
      missing: "Which project should be deleted?",
      example: "kaneo project delete KAN",
    });
    const key = project.slug.toUpperCase();

    yield* confirmByKey({
      yes: options.yes,
      action: `Deleting ${project.name}`,
      key,
      warning: `This permanently deletes ${project.name} (${key}) ${contents(project.statistics.totalTasks)}. It cannot be undone; kaneo project archive ${key} keeps the data instead.`,
    });

    const deleted = yield* withSpinner(`Deleting ${project.name}`)(
      deleteProject(project.id),
    );
    yield* emit(
      {
        ...toProjectRecordJson(deleted, project.statistics, session.webUrl),
        deleted: true,
      },
      (ui, json) =>
        renderProjectChange(ui, {
          verb: "Deleted",
          name: json.name,
          key: json.key,
          url: "",
          detail: json.totalTasks > 0 ? taskCount(json.totalTasks) : undefined,
        }),
    );
  },
);

export const projectDelete = Command.make(
  "delete",
  {
    project: Argument.String("project").pipe(
      Argument.withDescription("Project key or id, for example KAN"),
      Argument.optional,
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runProjectDelete(options),
).pipe(
  Command.withDescription(
    "Permanently delete a project with all its tasks, comments and columns",
  ),
  Command.provide(ApiLayer),
);
