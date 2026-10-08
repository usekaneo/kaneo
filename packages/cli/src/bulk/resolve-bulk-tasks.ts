import { Effect } from "effect";
import { getProject } from "../api/endpoints.js";
import type { Project } from "../api/schemas.js";
import { taskUrl } from "../render/links.js";
import { ticketId } from "../render/task-format.js";
import { Session } from "../services/session.js";
import { fetchTask } from "../tasks/resolve-task.js";
import { checkFound, checkSameWorkspace } from "./preflight.js";

export type BulkTask = {
  readonly id: string;
  readonly title: string;
  readonly ticketId: string | null;
  readonly label: string;
  readonly url: string;
  readonly project: Project;
  readonly workspaceId: string;
};

export const resolveBulkTasks = Effect.fn("bulk.resolveTasks")(function* (
  references: ReadonlyArray<string>,
) {
  const session = yield* Session;
  const lookups = yield* Effect.forEach(
    references,
    (reference) =>
      fetchTask(reference).pipe(
        Effect.map((task) => ({ reference, task })),
        Effect.catchTag("NotFound", () =>
          Effect.succeed({ reference, task: null }),
        ),
      ),
    { concurrency: 6 },
  );
  const tasks = yield* Effect.fromResult(checkFound(lookups));
  const projectIds = [...new Set(tasks.map((task) => task.projectId))];
  const projects = new Map(
    (yield* Effect.forEach(projectIds, (id) => getProject(id), {
      concurrency: 4,
    })).map((project) => [project.id, project]),
  );
  const resolved = tasks.flatMap((task): BulkTask[] => {
    const project = projects.get(task.projectId);
    if (!project) return [];
    const id = ticketId(project.slug, task.number);
    const workspaceId = task.workspaceId ?? project.workspaceId;
    return [
      {
        id: task.id,
        title: task.title,
        ticketId: id,
        label: id ?? task.id.slice(0, 8),
        url: taskUrl(session.webUrl, {
          workspaceId,
          projectId: task.projectId,
          id: task.id,
        }),
        project,
        workspaceId,
      },
    ];
  });
  const workspaceId = yield* Effect.fromResult(checkSameWorkspace(resolved));
  return { workspaceId, tasks: resolved };
});
