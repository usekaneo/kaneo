import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
} from "../../database/schema";
import type { TelegramEventData } from "./message";

function getTaskUrl(
  clientUrl: string | undefined,
  workspaceId: string,
  projectId: string,
  taskId: string,
): string | null {
  const normalizedClientUrl = clientUrl?.trim();
  if (!normalizedClientUrl) {
    return null;
  }

  try {
    return new URL(
      `/dashboard/workspace/${workspaceId}/project/${projectId}/task/${taskId}`,
      normalizedClientUrl,
    ).toString();
  } catch {
    return null;
  }
}

type TelegramUser = {
  id: string;
  name: string;
  telegramHandle: string | null;
};

export async function getTelegramEventData(
  taskId: string,
  projectId: string,
  actorId: string | null,
  assigneeId: string | null,
): Promise<TelegramEventData | null> {
  const taskPromise = db
    .select({
      title: taskTable.title,
      number: taskTable.number,
      status: taskTable.status,
      priority: taskTable.priority,
      projectName: projectTable.name,
      projectId: projectTable.id,
      workspaceId: workspaceTable.id,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(and(eq(taskTable.id, taskId), eq(projectTable.id, projectId)))
    .limit(1);

  const ids = [
    ...new Set([actorId, assigneeId].filter((id): id is string => Boolean(id))),
  ];
  const usersPromise: Promise<TelegramUser[]> = ids.length
    ? db
        .select({
          id: userTable.id,
          name: userTable.name,
          telegramHandle: userTable.telegramHandle,
        })
        .from(userTable)
        .where(inArray(userTable.id, ids))
        .limit(ids.length)
    : Promise.resolve([]);

  const [[taskRow], users] = await Promise.all([taskPromise, usersPromise]);

  if (!taskRow) {
    return null;
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const actor = actorId ? usersById.get(actorId) : undefined;
  const assignee = assigneeId ? usersById.get(assigneeId) : undefined;

  return {
    taskTitle: taskRow.title,
    taskNumber: taskRow.number,
    projectName: taskRow.projectName,
    taskUrl: getTaskUrl(
      process.env.KANEO_CLIENT_URL,
      taskRow.workspaceId,
      taskRow.projectId,
      taskId,
    ),
    actorName: actor?.name ?? null,
    assignee: assignee
      ? { name: assignee.name, telegramHandle: assignee.telegramHandle }
      : null,
    status: taskRow.status,
    priority: taskRow.priority,
  };
}
