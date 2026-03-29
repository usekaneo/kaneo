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
import { postToSlack } from "./client";
import type { SlackConfig, SlackEventKey } from "./config";
import { normalizeSlackConfig } from "./config";

type SlackEventData = {
  taskTitle: string;
  taskNumber: number | null;
  projectName: string;
  taskUrl: string | null;
  actorName: string | null;
  status: string | null;
  priority: string | null;
};

function isEnabled(config: SlackConfig, key: SlackEventKey): boolean {
  const normalized = normalizeSlackConfig(config);
  return normalized.events?.[key] ?? false;
}

function toSentenceCase(value: string | null): string {
  if (!value) return "Unknown";
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

async function getSlackEventData(
  taskId: string,
  projectId: string,
  userId: string | null,
): Promise<SlackEventData | null> {
  const [taskRow] = await db
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

  if (!taskRow) {
    return null;
  }

  const [user] = userId
    ? await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1)
    : [];

  const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
  const taskUrl = `${clientUrl}/dashboard/workspace/${taskRow.workspaceId}/project/${taskRow.projectId}/task/${taskId}`;

  return {
    taskTitle: taskRow.title,
    taskNumber: taskRow.number,
    projectName: taskRow.projectName,
    taskUrl,
    actorName: user?.name ?? null,
    status: taskRow.status,
    priority: taskRow.priority,
  };
}

async function sendSlackMessage(
  config: SlackConfig,
  title: string,
  body: string,
  data: SlackEventData,
): Promise<void> {
  const issueKey =
    data.taskNumber !== null ? `#${data.taskNumber}` : "Task update";
  const taskLabel = data.taskUrl
    ? `<${data.taskUrl}|${issueKey} ${data.taskTitle}>`
    : `${issueKey} ${data.taskTitle}`;

  await postToSlack(config.webhookUrl, {
    text: `${title}: ${data.taskTitle}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${title}*\n${body}`,
        },
        fields: [
          {
            type: "mrkdwn",
            text: `*Task*\n${taskLabel}`,
          },
          {
            type: "mrkdwn",
            text: `*Project*\n${data.projectName}`,
          },
          {
            type: "mrkdwn",
            text: `*Status*\n${toSentenceCase(data.status)}`,
          },
          {
            type: "mrkdwn",
            text: `*Priority*\n${toSentenceCase(data.priority)}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: data.actorName
              ? `Triggered by ${data.actorName}`
              : "Triggered by Kaneo",
          },
        ],
      },
    ],
  });
}

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeSlackConfig(context.config as SlackConfig);
  if (!isEnabled(config, "taskCreated")) return;

  const data = await getSlackEventData(
    event.taskId,
    event.projectId,
    event.userId,
  );
  if (!data) return;

  await sendSlackMessage(
    config,
    "New task created",
    `A new task was added: *${event.title}*`,
    data,
  );
}

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeSlackConfig(context.config as SlackConfig);
  if (!isEnabled(config, "taskStatusChanged")) return;

  const data = await getSlackEventData(
    event.taskId,
    event.projectId,
    event.userId,
  );
  if (!data) return;

  await sendSlackMessage(
    config,
    "Task status changed",
    `*${event.title}* moved from *${toSentenceCase(event.oldStatus)}* to *${toSentenceCase(event.newStatus)}*.`,
    data,
  );
}

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeSlackConfig(context.config as SlackConfig);
  if (!isEnabled(config, "taskPriorityChanged")) return;

  const data = await getSlackEventData(
    event.taskId,
    event.projectId,
    event.userId,
  );
  if (!data) return;

  await sendSlackMessage(
    config,
    "Task priority changed",
    `*${event.title}* changed from *${toSentenceCase(event.oldPriority)}* to *${toSentenceCase(event.newPriority)}*.`,
    data,
  );
}

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeSlackConfig(context.config as SlackConfig);
  if (!isEnabled(config, "taskTitleChanged")) return;

  const data = await getSlackEventData(
    event.taskId,
    event.projectId,
    event.userId,
  );
  if (!data) return;

  await sendSlackMessage(
    config,
    "Task title changed",
    `Task renamed from *${truncate(event.oldTitle, 120)}* to *${truncate(event.newTitle, 120)}*.`,
    data,
  );
}

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeSlackConfig(context.config as SlackConfig);
  if (!isEnabled(config, "taskDescriptionChanged")) return;

  const data = await getSlackEventData(
    event.taskId,
    event.projectId,
    event.userId,
  );
  if (!data) return;

  await sendSlackMessage(
    config,
    "Task description changed",
    `The task description was updated${event.newDescription ? `: ${truncate(event.newDescription.replace(/\s+/g, " "), 160)}` : "."}`,
    data,
  );
}

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeSlackConfig(context.config as SlackConfig);
  if (!isEnabled(config, "taskCommentCreated")) return;

  const data = await getSlackEventData(
    event.taskId,
    event.projectId,
    event.userId,
  );
  if (!data) return;

  await sendSlackMessage(
    config,
    "New task comment",
    truncate(event.comment.replace(/\s+/g, " "), 200),
    data,
  );
}
