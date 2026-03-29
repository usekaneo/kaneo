import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
} from "../../database/schema";
import type {
  PluginContext,
  TaskCommentCreatedEvent,
  TaskCreatedEvent,
  TaskDescriptionChangedEvent,
  TaskPriorityChangedEvent,
  TaskStatusChangedEvent,
  TaskTitleChangedEvent,
} from "../types";
import { postToGenericWebhook } from "./client";
import type { GenericWebhookConfig, GenericWebhookEventKey } from "./config";
import { normalizeGenericWebhookConfig } from "./config";

type GenericWebhookTaskData = {
  id: string;
  title: string;
  number: number | null;
  status: string | null;
  priority: string | null;
  projectId: string;
  projectName: string;
  workspaceId: string;
  taskUrl: string;
};

function isEnabled(
  config: GenericWebhookConfig,
  key: GenericWebhookEventKey,
): boolean {
  return config.events?.[key] ?? false;
}

async function getTaskData(
  taskId: string,
  projectId: string,
): Promise<GenericWebhookTaskData | null> {
  const [taskRow] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      status: taskTable.status,
      priority: taskTable.priority,
      projectId: projectTable.id,
      projectName: projectTable.name,
      workspaceId: workspaceTable.id,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(and(eq(taskTable.id, taskId), eq(projectTable.id, projectId)))
    .limit(1);

  if (!taskRow) {
    return null;
  }

  const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";

  return {
    ...taskRow,
    taskUrl: `${clientUrl}/dashboard/workspace/${taskRow.workspaceId}/project/${taskRow.projectId}/task/${taskId}`,
  };
}

async function getActor(userId: string | null): Promise<{
  id: string | null;
  name: string | null;
}> {
  if (!userId) {
    return {
      id: null,
      name: null,
    };
  }

  const [user] = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  return {
    id: user?.id ?? userId,
    name: user?.name ?? null,
  };
}

async function sendEvent(
  config: GenericWebhookConfig,
  eventName: string,
  taskId: string,
  projectId: string,
  userId: string | null,
  data: Record<string, unknown>,
): Promise<void> {
  const task = await getTaskData(taskId, projectId);
  if (!task) return;

  const actor = await getActor(userId);

  try {
    await postToGenericWebhook(
      config.webhookUrl,
      {
        event: eventName,
        timestamp: new Date().toISOString(),
        integration: {
          type: "generic-webhook",
        },
        project: {
          id: task.projectId,
          name: task.projectName,
          workspaceId: task.workspaceId,
        },
        task: {
          id: task.id,
          number: task.number,
          title: task.title,
          status: task.status,
          priority: task.priority,
          url: task.taskUrl,
        },
        actor,
        data,
      },
      config.secret,
    );
  } catch (error) {
    console.error("sendEvent postToGenericWebhook failed", {
      error,
      eventName,
      taskId,
      projectId,
      webhookUrl: config.webhookUrl,
    });
  }
}

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskCreated")) return;

  await sendEvent(
    config,
    "task.created",
    event.taskId,
    event.projectId,
    event.userId,
    {
      title: event.title,
      description: event.description,
      priority: event.priority,
      status: event.status,
      number: event.number,
    },
  );
}

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskStatusChanged")) return;

  await sendEvent(
    config,
    "task.status_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      title: event.title,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
    },
  );
}

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskPriorityChanged")) return;

  await sendEvent(
    config,
    "task.priority_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      title: event.title,
      oldPriority: event.oldPriority,
      newPriority: event.newPriority,
    },
  );
}

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskTitleChanged")) return;

  await sendEvent(
    config,
    "task.title_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      oldTitle: event.oldTitle,
      newTitle: event.newTitle,
    },
  );
}

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskDescriptionChanged")) return;

  await sendEvent(
    config,
    "task.description_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      oldDescription: event.oldDescription,
      newDescription: event.newDescription,
    },
  );
}

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskCommentCreated")) return;

  await sendEvent(
    config,
    "task.comment_created",
    event.taskId,
    event.projectId,
    event.userId,
    {
      comment: event.comment,
    },
  );
}
