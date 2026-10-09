import type {
  RelatedTask,
  TaskRelationWithTasks,
} from "../api/task-relations.js";
import { taskUrl } from "../render/links.js";
import { ticketId } from "../render/task-format.js";
import {
  perspectiveOf,
  type RelationDirection,
  relationOrder,
} from "./relation-types.js";

export type RelatedTaskJson = {
  readonly id: string;
  readonly ticketId: string | null;
  readonly title: string;
  readonly status: string;
  readonly completed: boolean;
  readonly url: string;
};

export type RelationJson = {
  readonly type: string;
  readonly direction: RelationDirection;
  readonly task: RelatedTaskJson;
};

export type RelationsJson = {
  readonly parent: RelatedTaskJson | null;
  readonly subtasks: ReadonlyArray<RelatedTaskJson>;
  readonly relations: ReadonlyArray<RelationJson>;
};

export type TaskContext = {
  readonly projectSlugs: ReadonlyMap<string, string>;
  readonly workspaceId: string;
  readonly webUrl: string;
};

export function relatedTaskJson(
  task: RelatedTask,
  context: TaskContext,
): RelatedTaskJson {
  const slug = context.projectSlugs.get(task.projectId);
  return {
    id: task.id,
    ticketId: slug ? ticketId(slug, task.number) : null,
    title: task.title,
    status: task.status,
    completed: task.isCompleted,
    url: taskUrl(context.webUrl, {
      workspaceId: context.workspaceId,
      projectId: task.projectId,
      id: task.id,
    }),
  };
}

function byTicket(a: RelatedTaskJson, b: RelatedTaskJson): number {
  return (a.ticketId ?? a.title).localeCompare(b.ticketId ?? b.title, "en", {
    numeric: true,
  });
}

export function groupRelations(
  relations: ReadonlyArray<TaskRelationWithTasks>,
  taskId: string,
  context: TaskContext,
): RelationsJson {
  const parents: RelatedTaskJson[] = [];
  const subtasks: RelatedTaskJson[] = [];
  const others: RelationJson[] = [];
  for (const relation of relations) {
    const outgoing = relation.sourceTaskId === taskId;
    const linked = outgoing ? relation.targetTask : relation.sourceTask;
    if (!linked || linked.id === taskId) continue;
    const task = relatedTaskJson(linked, context);
    const perspective = perspectiveOf(relation, taskId);
    if (perspective.type === "parent-of") subtasks.push(task);
    else if (perspective.type === "subtask-of") parents.push(task);
    else others.push({ ...perspective, task });
  }
  parents.sort(byTicket);
  const [parent = null, ...extraParents] = parents;
  const relationsJson = [
    ...extraParents.map((task): RelationJson => ({
      type: "subtask-of",
      direction: "incoming",
      task,
    })),
    ...others,
  ].sort(
    (a, b) =>
      relationOrder(a.type) - relationOrder(b.type) ||
      a.type.localeCompare(b.type) ||
      byTicket(a.task, b.task),
  );
  return {
    parent,
    subtasks: subtasks.sort(byTicket),
    relations: relationsJson,
  };
}

export function relationsBetween(
  relations: ReadonlyArray<TaskRelationWithTasks>,
  taskId: string,
  otherId: string,
  type: string | undefined,
): TaskRelationWithTasks[] {
  return relations.filter((relation) => {
    const linked =
      (relation.sourceTaskId === taskId && relation.targetTaskId === otherId) ||
      (relation.sourceTaskId === otherId && relation.targetTaskId === taskId);
    return (
      linked &&
      (type === undefined || perspectiveOf(relation, taskId).type === type)
    );
  });
}
