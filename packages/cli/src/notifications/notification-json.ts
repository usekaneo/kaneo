import type { NotificationTask } from "../api/notifications.js";
import { taskUrl } from "../render/links.js";
import { ticketId } from "../render/task-format.js";
import type { NotificationView } from "./normalize-notification.js";

export type NotificationJson = {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly message: string | null;
  readonly read: boolean;
  readonly createdAt: string;
  readonly workspaceId: string | null;
  readonly task: {
    readonly id: string;
    readonly ticketId: string | null;
    readonly title: string | null;
    readonly url: string | null;
  } | null;
};

export type TaskLookup = {
  readonly tasks: ReadonlyMap<string, NotificationTask>;
  readonly projectSlugs: ReadonlyMap<string, string>;
};

export function toNotificationJson(
  view: NotificationView,
  lookup: TaskLookup,
  webUrl: string,
): NotificationJson {
  const base = {
    id: view.id,
    type: view.type,
    title: view.title,
    message: view.message,
    read: view.read,
    createdAt: view.createdAt,
    workspaceId: view.workspaceId,
  };
  if (view.taskId === null) return { ...base, task: null };
  const found = lookup.tasks.get(view.taskId);
  const projectId = found?.projectId ?? view.projectId;
  const slug = projectId ? lookup.projectSlugs.get(projectId) : undefined;
  return {
    ...base,
    task: {
      id: view.taskId,
      ticketId: found && slug ? ticketId(slug, found.number) : null,
      title: found?.title ?? view.taskTitle,
      url:
        projectId && view.workspaceId
          ? taskUrl(webUrl, {
              workspaceId: view.workspaceId,
              projectId,
              id: view.taskId,
            })
          : null,
    },
  };
}
