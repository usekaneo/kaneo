import { Effect, type Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listWorkspaces } from "../../api/endpoints.js";
import { moveProject } from "../../api/project-writes.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit, note } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { toProjectRecordJson } from "../../projects-write/project-record-json.js";
import { renderProjectChange } from "../../projects-write/render-project-change.js";
import { resolveProjectRecord } from "../../projects-write/resolve-project-record.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { matchWorkspace } from "../workspace/match-workspace.js";
import { ApiLayer } from "../api-layer.js";

function taskCount(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}

export const runProjectMove = Effect.fn("command.project.move")(
  function* (options: {
    readonly project: Option.Option<string>;
    readonly to: string;
    readonly yes: boolean;
  }) {
    const session = yield* Session;
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProjectRecord({
      workspaceId,
      reference: options.project,
      scope: "any",
      useContext: false,
      prompt: "Choose a project to move",
      missing: "Which project should be moved?",
      example: "kaneo project move KAN --to acme",
    });
    const workspaces =
      yield* withSpinner("Loading workspaces")(listWorkspaces());
    const match = matchWorkspace(workspaces, options.to);
    if (match.kind === "none") {
      return yield* new InvalidArgument({
        message: `No workspace matches "${options.to}".`,
        hint: "Run kaneo workspace list to see the ids and slugs.",
      });
    }
    if (match.kind === "ambiguous") {
      return yield* new InvalidArgument({
        message: `"${options.to}" matches more than one workspace.`,
        hint: `Pass the id instead: ${match.candidates.map((candidate) => candidate.id).join(", ")}.`,
      });
    }
    const destination = match.workspace;
    if (destination.id === project.workspaceId) {
      return yield* new InvalidArgument({
        message: `${project.name} is already in ${destination.name}.`,
        hint: "Pass --to with another workspace id or slug.",
      });
    }

    const key = project.slug.toUpperCase();
    yield* confirmDestructive({
      yes: options.yes,
      action: `Moving ${project.name} to ${destination.name}`,
      question:
        project.statistics.totalTasks === 0
          ? `Move ${project.name} (${key}) to ${destination.name}?`
          : `Move ${project.name} (${key}) and its ${taskCount(project.statistics.totalTasks)} to ${destination.name}? Assignees without access there are unassigned.`,
    });

    const moved = yield* withSpinner(
      `Moving ${project.name} to ${destination.name}`,
    )(moveProject(project.id, destination.id));

    yield* emit(
      {
        ...toProjectRecordJson(moved, project.statistics, session.webUrl),
        unassignedTaskCount: moved.unassignedTaskCount,
      },
      (ui, json) =>
        renderProjectChange(ui, {
          verb: "Moved",
          name: json.name,
          key: json.key,
          url: json.url,
          target: destination.name,
        }),
    );
    if (moved.unassignedTaskCount > 0) {
      yield* note((ui) => [
        `  ${ui.theme.warning(ui.glyphs.warning)} ${taskCount(moved.unassignedTaskCount)} lost ${moved.unassignedTaskCount === 1 ? "its assignee, who" : "their assignees, who"} cannot access ${destination.name}.`,
        "",
      ]);
    }
  },
);

export const projectMove = Command.make(
  "move",
  {
    project: Argument.String("project").pipe(
      Argument.withDescription("Project key or id, for example KAN"),
      Argument.optional,
    ),
    to: Flag.String("to").pipe(
      Flag.withDescription("Destination workspace id or slug"),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Move without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runProjectMove(options),
).pipe(
  Command.withDescription("Move a project and its tasks to another workspace"),
  Command.provide(ApiLayer),
);
