import type { SortConfig } from "@/lib/sort-tasks";
import { sortTasks } from "@/lib/sort-tasks";
import type Task from "@/types/task";
import type { TaskTreeNode, TaskWithHierarchy } from "@/types/task";

export type HierarchyMode = "flat" | "tree" | "nested";

type ColumnLike = {
  id: string;
  tasks: Task[];
};

function withHierarchyDefaults(task: Task): TaskWithHierarchy {
  return {
    ...task,
    parentId: task.parentId ?? null,
    directSubtaskCount: task.directSubtaskCount ?? 0,
    completedSubtaskCount: task.completedSubtaskCount ?? 0,
  };
}

export function buildParentMap(tasks: Task[]): Map<string, string> {
  const parentMap = new Map<string, string>();
  for (const task of tasks) {
    if (task.parentId) {
      parentMap.set(task.id, task.parentId);
    }
  }
  return parentMap;
}

export function buildChildrenMap(
  tasks: Task[],
  parentMap: Map<string, string>,
): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>();
  const taskIds = new Set(tasks.map((task) => task.id));

  for (const task of tasks) {
    const parentId = parentMap.get(task.id);
    if (!parentId || !taskIds.has(parentId)) {
      continue;
    }
    const children = childrenMap.get(parentId) ?? [];
    children.push(task.id);
    childrenMap.set(parentId, children);
  }

  return childrenMap;
}

export function getRootTaskIds(
  tasks: Task[],
  parentMap: Map<string, string>,
): string[] {
  const taskIds = new Set(tasks.map((task) => task.id));
  return tasks
    .filter((task) => {
      const parentId = parentMap.get(task.id);
      return !parentId || !taskIds.has(parentId);
    })
    .map((task) => task.id);
}

function sortSiblingIds(
  taskIds: string[],
  taskMap: Map<string, Task>,
  sort: SortConfig,
): string[] {
  const tasks = taskIds
    .map((id) => taskMap.get(id))
    .filter((task): task is Task => task != null);
  return sortTasks(tasks, sort).map((task) => task.id);
}

function flattenSubtree(
  taskId: string,
  taskMap: Map<string, Task>,
  childrenMap: Map<string, string[]>,
  parentMap: Map<string, string>,
  expandedSet: Set<string>,
  sort: SortConfig,
  depth: number,
  visited: Set<string>,
  allowedTaskIds?: Set<string>,
): TaskTreeNode[] {
  if (visited.has(taskId)) {
    return [];
  }
  visited.add(taskId);

  const task = taskMap.get(taskId);
  if (!task) {
    return [];
  }

  const children = (childrenMap.get(taskId) ?? []).filter((childId) =>
    allowedTaskIds ? allowedTaskIds.has(childId) : true,
  );
  const hasChildren = children.length > 0;
  const parentId = parentMap.get(taskId) ?? null;
  const parentTask = parentId ? taskMap.get(parentId) : undefined;

  const node: TaskTreeNode = {
    ...withHierarchyDefaults(task),
    depth,
    hasChildren,
    parentInSameColumn: parentTask ? parentTask.status === task.status : false,
    parentTitle: parentTask?.title ?? null,
  };

  const nodes: TaskTreeNode[] = [node];

  if (!hasChildren || !expandedSet.has(taskId)) {
    return nodes;
  }

  const sortedChildren = sortSiblingIds(children, taskMap, sort);
  for (const childId of sortedChildren) {
    nodes.push(
      ...flattenSubtree(
        childId,
        taskMap,
        childrenMap,
        parentMap,
        expandedSet,
        sort,
        depth + 1,
        visited,
        allowedTaskIds,
      ),
    );
  }

  return nodes;
}

export function flattenTree(
  tasks: Task[],
  expandedSet: Set<string>,
  sort: SortConfig,
): TaskTreeNode[] {
  const parentMap = buildParentMap(tasks);
  const childrenMap = buildChildrenMap(tasks, parentMap);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const rootIds = sortSiblingIds(
    getRootTaskIds(tasks, parentMap),
    taskMap,
    sort,
  );
  const visited = new Set<string>();
  const nodes: TaskTreeNode[] = [];

  for (const rootId of rootIds) {
    nodes.push(
      ...flattenSubtree(
        rootId,
        taskMap,
        childrenMap,
        parentMap,
        expandedSet,
        sort,
        0,
        visited,
      ),
    );
  }

  return nodes;
}

export function groupNestedByColumn(
  columns: ColumnLike[],
  expandedSet: Set<string>,
  sort: SortConfig,
): Array<ColumnLike & { tasks: TaskTreeNode[] }> {
  const allTasks = columns.flatMap((column) => column.tasks);
  const parentMap = buildParentMap(allTasks);
  const childrenMap = buildChildrenMap(allTasks, parentMap);
  const taskMap = new Map(allTasks.map((task) => [task.id, task]));

  return columns.map((column) => {
    const columnTaskIds = new Set(column.tasks.map((task) => task.id));
    const topLevelIds = column.tasks
      .filter((task) => {
        const parentId = parentMap.get(task.id);
        if (!parentId) {
          return true;
        }
        return !columnTaskIds.has(parentId);
      })
      .map((task) => task.id);

    const sortedTopLevel = sortSiblingIds(topLevelIds, taskMap, sort);
    const visited = new Set<string>();
    const tasks: TaskTreeNode[] = [];

    for (const taskId of sortedTopLevel) {
      tasks.push(
        ...flattenSubtree(
          taskId,
          taskMap,
          childrenMap,
          parentMap,
          expandedSet,
          sort,
          0,
          visited,
          columnTaskIds,
        ).map((node) => ({
          ...node,
          hasChildren: (childrenMap.get(node.id) ?? []).some((childId) =>
            columnTaskIds.has(childId),
          ),
          parentInSameColumn:
            node.parentId != null && columnTaskIds.has(node.parentId),
        })),
      );
    }

    return {
      ...column,
      tasks,
    };
  });
}
