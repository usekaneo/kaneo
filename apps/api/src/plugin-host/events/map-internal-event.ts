import type { PluginEvent } from "@kaneo/plugin-sdk";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type MappedPluginEvent = DistributiveOmit<PluginEvent, "workspaceId">;

type Data = Record<string, unknown>;

type Base = {
  taskId: string;
  projectId: string;
  actorId: string | null;
};

function text(data: Data, key: string): string | null {
  const value = data[key];
  return typeof value === "string" ? value : null;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function isoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date =
    value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function base(data: Data, projectKey = "projectId"): Base | null {
  const taskId = text(data, "taskId");
  const projectId = text(data, projectKey);
  if (!taskId || !projectId) return null;
  return { taskId, projectId, actorId: nonEmpty(data.userId) };
}

function change(
  data: Data,
  fromKey: string,
  toKey: string,
): { from: string; to: string } | null {
  const from = text(data, fromKey);
  const to = text(data, toKey);
  return from === null || to === null ? null : { from, to };
}

const mappers: Record<string, (data: Data) => MappedPluginEvent | null> = {
  "task.created": (data) => {
    const taskId = text(data, "taskId") ?? text(data, "id");
    const projectId = text(data, "projectId");
    if (!taskId || !projectId) return null;
    return {
      type: "task.created",
      taskId,
      projectId,
      actorId: nonEmpty(data.currentUserId),
      title: text(data, "title") ?? "",
      status: text(data, "status") ?? "",
      priority: text(data, "priority"),
      number: typeof data.number === "number" ? data.number : null,
    };
  },
  "task.status_changed": (data) => {
    const common = base(data);
    const values = change(data, "oldStatus", "newStatus");
    return common && values
      ? { type: "task.status_changed", ...common, ...values }
      : null;
  },
  "task.priority_changed": (data) => {
    const common = base(data);
    return common
      ? {
          type: "task.priority_changed",
          ...common,
          from: text(data, "oldPriority"),
          to: text(data, "newPriority"),
        }
      : null;
  },
  "task.title_changed": (data) => {
    const common = base(data);
    const values = change(data, "oldTitle", "newTitle");
    return common && values
      ? { type: "task.title_changed", ...common, ...values }
      : null;
  },
  "task.description_changed": (data) => {
    const common = base(data);
    return common ? { type: "task.description_changed", ...common } : null;
  },
  "task.due_date_changed": (data) => {
    const common = base(data);
    return common
      ? {
          type: "task.due_date_changed",
          ...common,
          from: isoDate(data.oldDueDate),
          to: isoDate(data.newDueDate),
        }
      : null;
  },
  "task.assignee_changed": (data) => {
    const common = base(data);
    return common
      ? {
          type: "task.assignee_changed",
          ...common,
          from: nonEmpty(data.oldAssignee),
          to: nonEmpty(data.newAssigneeId),
        }
      : null;
  },
  "task.unassigned": (data) => {
    const common = base(data);
    return common
      ? {
          type: "task.assignee_changed",
          ...common,
          from: nonEmpty(data.oldAssignee),
          to: null,
        }
      : null;
  },
  "task.moved": (data) => {
    const common = base(data, "toProjectId");
    const fromProjectId = text(data, "fromProjectId");
    return common && fromProjectId
      ? {
          type: "task.moved",
          ...common,
          fromProjectId,
          toProjectId: common.projectId,
        }
      : null;
  },
  "task.deleted": (data) => {
    const common = base(data);
    return common
      ? { type: "task.deleted", ...common, title: text(data, "title") ?? "" }
      : null;
  },
  "comment.created": (data) => {
    const common = base(data);
    const commentId = text(data, "id");
    return common && commentId
      ? {
          type: "comment.created",
          ...common,
          commentId,
          content: text(data, "content") ?? "",
        }
      : null;
  },
  "project.moved": (data) => {
    const projectId = text(data, "projectId");
    const fromWorkspaceId = text(data, "fromWorkspaceId");
    const toWorkspaceId = text(data, "toWorkspaceId");
    if (!projectId || !fromWorkspaceId || !toWorkspaceId) return null;
    return {
      type: "project.moved",
      projectId,
      actorId: nonEmpty(data.userId),
      fromWorkspaceId,
      toWorkspaceId,
    };
  },
};

export const INTERNAL_EVENT_NAMES = Object.keys(mappers);

export function mapInternalEvent(
  name: string,
  data: unknown,
): MappedPluginEvent | null {
  const mapper = mappers[name];
  if (!mapper || typeof data !== "object" || data === null) return null;
  return mapper(data as Data);
}
