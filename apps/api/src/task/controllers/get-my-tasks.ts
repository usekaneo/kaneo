import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  externalLinkTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";

const MY_TASK_GROUP_ORDER = [
  "overdue",
  "pending",
  "inProgress",
  "done",
] as const;

const MY_TASK_GROUP_TITLES = {
  overdue: "Overdue",
  pending: "Pending",
  inProgress: "In Progress",
  done: "Done",
} as const;

const PRIORITY_RANK = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  "no-priority": 0,
} as const;

type MyTaskGroupId = (typeof MY_TASK_GROUP_ORDER)[number];

type MyTask = {
  assigneeId: string | null;
  assigneeImage: string | null;
  assigneeName: string | null;
  columnId: string | null;
  createdAt: Date;
  description: string | null;
  dueDate: Date | null;
  externalLinks: Array<{
    externalId: string;
    id: string;
    integrationId: string;
    metadata: Record<string, unknown> | null;
    resourceType: string;
    taskId: string;
    title: string | null;
    url: string;
  }>;
  id: string;
  isFinal: boolean;
  labels: Array<{
    color: string;
    id: string;
    name: string;
  }>;
  normalizedBucket: MyTaskGroupId;
  number: number | null;
  position: number | null;
  priority: string | null;
  projectIcon: string | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  startDate: Date | null;
  status: string;
  title: string;
  updatedAt: Date;
  userId: string | null;
};

type MyTaskSummary = {
  assigned: number;
  done: number;
  dueToday: number;
  inProgress: number;
  overdue: number;
  pending: number;
};

function getUtcDayKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function isDueToday(dueDate: Date | null, todayKey: string) {
  if (!dueDate) return false;

  return getUtcDayKey(dueDate) === todayKey;
}

function isOverdue(dueDate: Date | null, todayKey: string) {
  if (!dueDate) return false;

  return getUtcDayKey(dueDate) < todayKey;
}

function getPriorityRank(priority: string | null) {
  if (!priority) return PRIORITY_RANK["no-priority"];

  return PRIORITY_RANK[priority as keyof typeof PRIORITY_RANK] ?? 0;
}

function compareTasks(a: MyTask, b: MyTask) {
  if (a.dueDate && b.dueDate) {
    const dueDateDiff = a.dueDate.getTime() - b.dueDate.getTime();
    if (dueDateDiff !== 0) return dueDateDiff;
  } else if (a.dueDate) {
    return -1;
  } else if (b.dueDate) {
    return 1;
  }

  const priorityDiff =
    getPriorityRank(b.priority) - getPriorityRank(a.priority);
  if (priorityDiff !== 0) return priorityDiff;

  return b.createdAt.getTime() - a.createdAt.getTime();
}

function getNormalizedBucket({
  dueDate,
  isFinal,
  status,
  todayKey,
}: {
  dueDate: Date | null;
  isFinal: boolean;
  status: string;
  todayKey: string;
}): MyTaskGroupId {
  if (!isFinal && isOverdue(dueDate, todayKey)) {
    return "overdue";
  }

  if (isFinal || status === "done") {
    return "done";
  }

  if (status === "in-progress" || status === "in-review") {
    return "inProgress";
  }

  return "pending";
}

async function getMyTasks(workspaceId: string, userId: string) {
  const todayKey = getUtcDayKey(new Date());

  const taskRows = await db
    .select({
      assigneeId: userTable.id,
      assigneeImage: userTable.image,
      assigneeName: userTable.name,
      columnId: taskTable.columnId,
      createdAt: taskTable.createdAt,
      description: taskTable.description,
      dueDate: taskTable.dueDate,
      id: taskTable.id,
      number: taskTable.number,
      position: taskTable.position,
      priority: taskTable.priority,
      projectIcon: projectTable.icon,
      projectId: taskTable.projectId,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      startDate: taskTable.startDate,
      status: taskTable.status,
      title: taskTable.title,
      updatedAt: taskTable.updatedAt,
      userId: taskTable.userId,
    })
    .from(taskTable)
    .innerJoin(
      projectTable,
      and(
        eq(taskTable.projectId, projectTable.id),
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
      ),
    )
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(
      and(
        eq(taskTable.userId, userId),
        ne(taskTable.status, "planned"),
        ne(taskTable.status, "archived"),
      ),
    );

  const taskIds = taskRows.map((task) => task.id);
  const projectIds = [...new Set(taskRows.map((task) => task.projectId))];

  const labelsData =
    taskIds.length > 0
      ? await db
          .select({
            color: labelTable.color,
            id: labelTable.id,
            name: labelTable.name,
            taskId: labelTable.taskId,
          })
          .from(labelTable)
          .where(inArray(labelTable.taskId, taskIds))
      : [];

  const externalLinksData =
    taskIds.length > 0
      ? await db
          .select()
          .from(externalLinkTable)
          .where(inArray(externalLinkTable.taskId, taskIds))
      : [];

  const columns =
    projectIds.length > 0
      ? await db
          .select({
            isFinal: columnTable.isFinal,
            projectId: columnTable.projectId,
            slug: columnTable.slug,
          })
          .from(columnTable)
          .where(inArray(columnTable.projectId, projectIds))
      : [];

  const labelsByTaskId = new Map<
    string,
    Array<{ color: string; id: string; name: string }>
  >();
  for (const label of labelsData) {
    if (!label.taskId) continue;

    if (!labelsByTaskId.has(label.taskId)) {
      labelsByTaskId.set(label.taskId, []);
    }

    labelsByTaskId.get(label.taskId)?.push({
      color: label.color,
      id: label.id,
      name: label.name,
    });
  }

  const externalLinksByTaskId = new Map<
    string,
    Array<{
      externalId: string;
      id: string;
      integrationId: string;
      metadata: Record<string, unknown> | null;
      resourceType: string;
      taskId: string;
      title: string | null;
      url: string;
    }>
  >();

  for (const externalLink of externalLinksData) {
    if (!externalLinksByTaskId.has(externalLink.taskId)) {
      externalLinksByTaskId.set(externalLink.taskId, []);
    }

    externalLinksByTaskId.get(externalLink.taskId)?.push({
      ...externalLink,
      metadata: externalLink.metadata
        ? JSON.parse(externalLink.metadata)
        : null,
    });
  }

  const columnFinalityByStatus = new Map<string, boolean>();
  for (const column of columns) {
    columnFinalityByStatus.set(
      `${column.projectId}:${column.slug}`,
      column.isFinal,
    );
  }

  const groups = {
    done: [] as MyTask[],
    inProgress: [] as MyTask[],
    overdue: [] as MyTask[],
    pending: [] as MyTask[],
  };

  const summary: MyTaskSummary = {
    assigned: taskRows.length,
    done: 0,
    dueToday: 0,
    inProgress: 0,
    overdue: 0,
    pending: 0,
  };

  for (const task of taskRows) {
    const isFinal =
      columnFinalityByStatus.get(`${task.projectId}:${task.status}`) ??
      task.status === "done";
    const normalizedBucket = getNormalizedBucket({
      dueDate: task.dueDate,
      isFinal,
      status: task.status,
      todayKey,
    });

    const myTask: MyTask = {
      ...task,
      externalLinks: externalLinksByTaskId.get(task.id) || [],
      isFinal,
      labels: labelsByTaskId.get(task.id) || [],
      normalizedBucket,
    };

    groups[normalizedBucket].push(myTask);
    summary[normalizedBucket] += 1;

    if (!isFinal && isDueToday(task.dueDate, todayKey)) {
      summary.dueToday += 1;
    }
  }

  return {
    groups: MY_TASK_GROUP_ORDER.map((groupId) => ({
      id: groupId,
      tasks: groups[groupId].sort(compareTasks),
      title: MY_TASK_GROUP_TITLES[groupId],
    })),
    summary,
  };
}

export default getMyTasks;
