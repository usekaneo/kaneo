import { Effect, Option } from "effect";
import { getProject, listColumns } from "../api/endpoints.js";
import { KaneoApi } from "../api/kaneo-api.js";
import {
  type Column,
  type Project,
  type TaskDetail,
  TaskDetail as TaskDetailSchema,
} from "../api/schemas.js";
import { InvalidArgument, NotFound } from "../errors/errors.js";
import { taskUrl } from "../render/links.js";
import { ticketId } from "../render/task-format.js";
import { Session } from "../services/session.js";

const TICKET_ID = /^(\S+)-(\d+)$/u;

export type ResolvedTask = {
  readonly task: TaskDetail;
  readonly workspaceId: string;
  readonly project: Project;
  readonly columns: ReadonlyArray<Column>;
  readonly ticketId: string | null;
  readonly url: string;
};

export function isTicketId(reference: string): boolean {
  return TICKET_ID.test(reference.trim());
}

export const fetchTask = Effect.fn("tasks.fetch")(function* (
  reference: string,
) {
  const session = yield* Session;
  const api = yield* KaneoApi;
  const trimmed = reference.trim();
  const notFound = () =>
    new NotFound({ message: `Task ${trimmed} not found.` });

  if (isTicketId(trimmed)) {
    return yield* api
      .request(
        "GET",
        `/api/task/by-ticket-id/${encodeURIComponent(trimmed.toUpperCase())}`,
        TaskDetailSchema,
        {
          query: { workspaceId: Option.getOrUndefined(session.workspace)?.id },
        },
      )
      .pipe(
        Effect.catchTags({
          NotFound: () => Effect.fail(notFound()),
          Conflict: () =>
            Effect.fail(
              new InvalidArgument({
                message: `${trimmed.toUpperCase()} matches tasks in more than one workspace.`,
                hint: "Pass -w <workspace id> to choose one.",
              }),
            ),
        }),
      );
  }

  return yield* api
    .request(
      "GET",
      `/api/task/${encodeURIComponent(trimmed)}`,
      TaskDetailSchema,
      {
        query: { view: "detail" },
      },
    )
    .pipe(
      Effect.catchTags({
        NotFound: () => Effect.fail(notFound()),
        InvalidRequest: (error) =>
          /could not be determined/i.test(error.message)
            ? Effect.fail(notFound())
            : Effect.fail(error),
      }),
    );
});

export const resolveTask = Effect.fn("tasks.resolve")(function* (
  reference: string,
  options: { readonly columns?: boolean } = {},
) {
  const session = yield* Session;
  const task = yield* fetchTask(reference);
  const [project, columns] = yield* Effect.all(
    [
      getProject(task.projectId),
      options.columns
        ? listColumns(task.projectId)
        : Effect.succeed([] as ReadonlyArray<Column>),
    ],
    { concurrency: 2 },
  );
  const workspaceId = task.workspaceId ?? project.workspaceId;
  return {
    task,
    workspaceId,
    project,
    columns,
    ticketId: ticketId(project.slug, task.number),
    url: taskUrl(session.webUrl, {
      workspaceId,
      projectId: task.projectId,
      id: task.id,
    }),
  } satisfies ResolvedTask;
});
