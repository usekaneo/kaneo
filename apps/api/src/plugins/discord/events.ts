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
import { postToDiscord } from "./client";
import type { DiscordConfig, DiscordEventKey } from "./config";
import { normalizeDiscordConfig } from "./config";

type DiscordEventData = {
  taskTitle: string;
  taskNumber: number | null;
  projectName: string;
  taskUrl: string | null;
  actorName: string | null;
  status: string | null;
  priority: string | null;
};

function isEnabled(config: DiscordConfig, key: DiscordEventKey): boolean {
  return config.events?.[key] ?? false;
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

function redactWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const token = parts.at(-1) ?? "";
    const maskedToken =
      token.length > 6 ? `${token.slice(0, 2)}…${token.slice(-4)}` : "redacted";
    return `${url.origin}/${parts.slice(0, -1).join("/")}/${maskedToken}`;
  } catch {
    return "redacted";
  }
}

async function getDiscordEventData(
  taskId: string,
  projectId: string,
  userId: string | null,
): Promise<DiscordEventData | null> {
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

  const userPromise = userId
    ? db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1)
    : Promise.resolve([]);

  const [[taskRow], [user]] = await Promise.all([taskPromise, userPromise]);

  if (!taskRow) {
    return null;
  }

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

async function sendDiscordMessage(
  config: DiscordConfig,
  title: string,
  body: string,
  data: DiscordEventData,
): Promise<void> {
  const issueKey =
    data.taskNumber !== null ? `#${data.taskNumber}` : "Task update";
  const taskLabel = `${issueKey} ${data.taskTitle}`;

  try {
    await postToDiscord(config.webhookUrl, {
      content: `${title}: ${data.taskTitle}`,
      embeds: [
        {
          title,
          description: body,
          url: data.taskUrl ?? undefined,
          color: 0x5865f2,
          fields: [
            {
              name: "Task",
              value: data.taskUrl
                ? `[${taskLabel}](${data.taskUrl})`
                : taskLabel,
              inline: true,
            },
            {
              name: "Project",
              value: data.projectName,
              inline: true,
            },
            {
              name: "Status",
              value: toSentenceCase(data.status),
              inline: true,
            },
            {
              name: "Priority",
              value: toSentenceCase(data.priority),
              inline: true,
            },
          ],
          footer: {
            text: data.actorName
              ? `Triggered by ${data.actorName}`
              : "Triggered by Kaneo",
          },
        },
      ],
    });
  } catch (error) {
    console.error("sendDiscordMessage postToDiscord failed", {
      error,
      webhookUrl: redactWebhookUrl(config.webhookUrl),
      channelName: config.channelName ?? null,
      taskUrl: data.taskUrl,
    });
  }
}

type DiscordMessageContent = {
  title: string;
  body: string;
};

async function runDiscordHandler(
  context: PluginContext,
  event: {
    taskId: string;
    projectId: string;
    userId: string | null;
  },
  featureKey: DiscordEventKey,
  buildMessage: () => DiscordMessageContent,
): Promise<void> {
  const config = normalizeDiscordConfig(context.config as DiscordConfig);
  if (!isEnabled(config, featureKey)) return;

  const data = await getDiscordEventData(
    event.taskId,
    event.projectId,
    event.userId,
  );
  if (!data) return;

  const { title, body } = buildMessage();
  await sendDiscordMessage(config, title, body, data);
}

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  await runDiscordHandler(context, event, "taskCreated", () => ({
    title: "New task created",
    body: `A new task was added: **${event.title}**`,
  }));
}

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runDiscordHandler(context, event, "taskStatusChanged", () => ({
    title: "Task status changed",
    body: `**${event.title}** moved from **${toSentenceCase(event.oldStatus)}** to **${toSentenceCase(event.newStatus)}**.`,
  }));
}

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runDiscordHandler(context, event, "taskPriorityChanged", () => ({
    title: "Task priority changed",
    body: `**${event.title}** changed from **${toSentenceCase(event.oldPriority)}** to **${toSentenceCase(event.newPriority)}**.`,
  }));
}

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runDiscordHandler(context, event, "taskTitleChanged", () => ({
    title: "Task title changed",
    body: `Task renamed from **${truncate(event.oldTitle, 120)}** to **${truncate(event.newTitle, 120)}**.`,
  }));
}

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runDiscordHandler(context, event, "taskDescriptionChanged", () => ({
    title: "Task description changed",
    body: `The task description was updated${event.newDescription ? `: ${truncate(event.newDescription.replace(/\s+/g, " "), 160)}` : "."}`,
  }));
}

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  await runDiscordHandler(context, event, "taskCommentCreated", () => ({
    title: "New task comment",
    body: truncate(event.comment.replace(/\s+/g, " "), 200),
  }));
}
