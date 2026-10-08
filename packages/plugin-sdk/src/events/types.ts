export type TaskEventBase = {
  workspaceId: string;
  projectId: string;
  taskId: string;
  actorId: string | null;
};

type Change<T> = {
  from: T;
  to: T;
};

export type PluginEventMap = {
  "task.created": TaskEventBase & {
    title: string;
    status: string;
    priority: string | null;
    number: number | null;
  };
  "task.status_changed": TaskEventBase & Change<string>;
  "task.priority_changed": TaskEventBase & Change<string | null>;
  "task.title_changed": TaskEventBase & Change<string>;
  "task.description_changed": TaskEventBase;
  "task.due_date_changed": TaskEventBase & Change<string | null>;
  "task.assignee_changed": TaskEventBase & Change<string | null>;
  "task.moved": TaskEventBase & {
    fromProjectId: string;
    toProjectId: string;
  };
  "task.deleted": TaskEventBase & { title: string };
  "comment.created": TaskEventBase & {
    commentId: string;
    content: string;
  };
};

export type PluginEventName = keyof PluginEventMap;

export type PluginEvent<E extends PluginEventName = PluginEventName> = {
  [K in E]: PluginEventMap[K] & { type: K };
}[E];
