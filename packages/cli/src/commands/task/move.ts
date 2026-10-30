import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listColumns, listProjects } from "../../api/endpoints.js";
import type { Project } from "../../api/schemas.js";
import { moveTask } from "../../api/task-actions.js";
import { InvalidArgument, ProjectNotFound } from "../../errors/errors.js";
import { emit, note } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { pick } from "../../prompts/pick.js";
import { taskUrl } from "../../render/links.js";
import { ticketId } from "../../render/task-format.js";
import { matchProject } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { matchColumn } from "../../tasks/match-column.js";
import { renderTaskMove } from "../../tasks/render-task-move.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

export const runTaskMove = Effect.fn("command.task.move")(function* (options: {
  readonly task: string;
  readonly project: Option.Option<string>;
  readonly status: Option.Option<string>;
}) {
  const session = yield* Session;
  const output = yield* Output;
  const resolved = yield* withSpinner(`Loading ${options.task}`)(
    resolveTask(options.task),
  );
  const fromLabel = resolved.ticketId ?? resolved.task.id.slice(0, 8);
  const projects = (yield* withSpinner("Loading projects")(
    listProjects(resolved.workspaceId),
  )).filter((project) => project.archivedAt === null);
  const others = projects.filter(
    (project) => project.id !== resolved.project.id,
  );

  const destination: Project = yield* Option.match(options.project, {
    onSome: (reference) => {
      const match = matchProject(projects, reference);
      if (!match)
        return Effect.fail(
          new ProjectNotFound({ query: reference, source: null }),
        );
      if (match.id === resolved.project.id) {
        return Effect.fail(
          new InvalidArgument({
            message: `${fromLabel} is already in ${match.name}.`,
            hint: "Pass --project with another project key, or use kaneo task status to change its column.",
          }),
        );
      }
      return Effect.succeed(match);
    },
    onNone: () => {
      if (others.length === 0) {
        return Effect.fail(
          new InvalidArgument({
            message: `There is no other project to move ${fromLabel} to.`,
          }),
        );
      }
      return output.interactive
        ? pick(
            `Move ${fromLabel} to`,
            others.map((project) => ({
              title: project.name,
              value: project,
              description: project.slug.toUpperCase(),
            })),
          )
        : Effect.fail(
            new InvalidArgument({
              message: `Pass the project to move ${fromLabel} to.`,
              hint: `Pass --project with a project key, for example --project ${others[0]?.slug.toUpperCase() ?? "KAN"}.`,
            }),
          );
    },
  });

  const status = yield* Option.match(options.status, {
    onNone: () => Effect.succeed(undefined),
    onSome: (reference) =>
      withSpinner(`Loading ${destination.name}`)(
        listColumns(destination.id),
      ).pipe(
        Effect.flatMap((columns) => {
          const match = matchColumn(columns, reference);
          return match
            ? Effect.succeed(match.slug)
            : Effect.fail(
                new InvalidArgument({
                  message: `No column in ${destination.name} matches "${reference}".`,
                  hint: `Use one of: ${[...columns]
                    .sort((a, b) => a.position - b.position)
                    .map((column) => column.slug)
                    .join(", ")}.`,
                }),
              );
        }),
      ),
  });

  const moved = yield* withSpinner(
    `Moving ${fromLabel} to ${destination.name}`,
  )(moveTask(resolved.task.id, { projectId: destination.id, status }));
  const toTicketId = ticketId(destination.slug, moved.task.number);
  const url = taskUrl(session.webUrl, {
    workspaceId: resolved.workspaceId,
    projectId: moved.destinationProjectId,
    id: moved.task.id,
  });

  yield* emit(
    {
      id: moved.task.id,
      from: { ticketId: resolved.ticketId, projectId: moved.sourceProjectId },
      to: { ticketId: toTicketId, projectId: moved.destinationProjectId },
      url,
    },
    (ui) =>
      renderTaskMove(ui, {
        fromLabel,
        toLabel: toTicketId ?? moved.task.id.slice(0, 8),
        title: moved.task.title,
        url,
      }),
  );

  if (resolved.task.assigneeId && moved.task.userId === null) {
    yield* note((ui) => [
      `  ${ui.theme.warning(ui.glyphs.warning)} ${resolved.task.assigneeName ?? "The assignee"} cannot access ${destination.name}, so the task is now unassigned.`,
      "",
    ]);
  }
});

export const taskMove = Command.make(
  "move",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Destination project key or id, for example MOB"),
      Flag.optional,
    ),
    status: Flag.String("status").pipe(
      Flag.withAlias("s"),
      Flag.withDescription(
        "Column in the destination project; defaults to the same column, or the first one",
      ),
      Flag.optional,
    ),
  },
  (options) => runTaskMove(options),
).pipe(
  Command.withDescription("Move a task to another project"),
  Command.provide(ApiLayer),
);
