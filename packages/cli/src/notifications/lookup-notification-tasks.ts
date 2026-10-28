import { Effect } from "effect";
import { listProjects } from "../api/endpoints.js";
import { getNotificationTask } from "../api/notifications.js";
import type { NotificationView } from "./normalize-notification.js";
import type { TaskLookup } from "./notification-json.js";

const unique = (values: ReadonlyArray<string | null>) => [
  ...new Set(values.filter((value): value is string => value !== null)),
];

export const lookupNotificationTasks = Effect.fn("notifications.lookupTasks")(
  function* (views: ReadonlyArray<NotificationView>) {
    const related = views.filter((view) => view.taskId !== null);
    const [tasks, projects] = yield* Effect.all(
      [
        Effect.forEach(
          unique(related.map((view) => view.taskId)),
          (taskId) =>
            getNotificationTask(taskId).pipe(
              Effect.map((task) => [task]),
              Effect.catchTags({
                NotFound: () => Effect.succeed([]),
                PermissionDenied: () => Effect.succeed([]),
                InvalidRequest: () => Effect.succeed([]),
              }),
            ),
          { concurrency: 6 },
        ),
        Effect.forEach(
          unique(related.map((view) => view.workspaceId)),
          (workspaceId) =>
            listProjects(workspaceId).pipe(
              Effect.catchTags({
                NotFound: () => Effect.succeed([]),
                PermissionDenied: () => Effect.succeed([]),
                InvalidRequest: () => Effect.succeed([]),
              }),
            ),
          { concurrency: 3 },
        ),
      ],
      { concurrency: 2 },
    );
    return {
      tasks: new Map(tasks.flat().map((task) => [task.id, task])),
      projectSlugs: new Map(
        projects.flat().map((project) => [project.id, project.slug]),
      ),
    } satisfies TaskLookup;
  },
);
