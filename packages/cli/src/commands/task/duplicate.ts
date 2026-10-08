import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listProjects } from "../../api/endpoints.js";
import { moveTask } from "../../api/task-actions.js";
import { duplicateTask } from "../../api/task-duplicate.js";
import { InvalidArgument, ProjectNotFound } from "../../errors/errors.js";
import { emit, note } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { matchProject } from "../../services/selection.js";
import { renderTaskDuplicated } from "../../tasks/render-task-duplicated.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { toTaskDetailJson } from "../../tasks/task-detail-json.js";
import { ApiLayer } from "../api-layer.js";

export const runTaskDuplicate = Effect.fn("command.task.duplicate")(
  function* (options: {
    readonly task: string;
    readonly title: Option.Option<string>;
    readonly project: Option.Option<string>;
  }) {
    const title = Option.map(options.title, (value) => value.trim());
    if (Option.isSome(title) && title.value === "") {
      return yield* new InvalidArgument({
        message: "The title cannot be empty.",
        hint: "Leave out --title to keep the original title.",
      });
    }
    const source = yield* withSpinner(`Loading ${options.task.trim()}`)(
      resolveTask(options.task),
    );
    const sourceLabel = source.ticketId ?? source.task.id.slice(0, 8);
    const destination = yield* Option.match(options.project, {
      onNone: () => Effect.succeed(null),
      onSome: (reference) =>
        withSpinner("Loading projects")(listProjects(source.workspaceId)).pipe(
          Effect.flatMap((projects) => {
            const match = matchProject(
              projects.filter((project) => project.archivedAt === null),
              reference,
            );
            return match
              ? Effect.succeed(match.id === source.project.id ? null : match)
              : Effect.fail(
                  new ProjectNotFound({ query: reference, source: null }),
                );
          }),
        ),
    });

    const copy = yield* withSpinner(`Duplicating ${sourceLabel}`)(
      duplicateTask(source.task.id, Option.getOrUndefined(title)),
    );
    if (destination) {
      yield* withSpinner(`Moving the copy to ${destination.name}`)(
        moveTask(copy.id, { projectId: destination.id, status: undefined }),
      ).pipe(
        Effect.tapError(() =>
          note((ui) => [
            `  ${ui.theme.warning(ui.glyphs.warning)} The copy was created in ${source.project.name}${copy.number === null ? "" : ` as ${source.project.slug.toUpperCase()}-${copy.number}`}, but could not be moved to ${destination.name}.`,
          ]),
        ),
      );
    }

    const created = yield* withSpinner("Loading the copy")(
      resolveTask(copy.id, { columns: true }),
    );
    const json = toTaskDetailJson(created);
    yield* emit(
      {
        ...json,
        source: { id: source.task.id, ticketId: source.ticketId },
      },
      (ui, task) =>
        renderTaskDuplicated(ui, {
          sourceLabel,
          label: task.ticketId ?? task.id.slice(0, 8),
          url: task.url,
          title: task.title,
        }),
    );
  },
);

export const taskDuplicate = Command.make(
  "duplicate",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    title: Flag.String("title").pipe(
      Flag.withDescription("Title for the copy (default: the same title)"),
      Flag.optional,
    ),
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription(
        "Put the copy in this project instead, for example MOB",
      ),
      Flag.optional,
    ),
  },
  (options) => runTaskDuplicate(options),
).pipe(
  Command.withDescription(
    "Copy a task with its description, labels and custom fields",
  ),
  Command.provide(ApiLayer),
);
