import { createHash } from "node:crypto";
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
import { postToTelegram } from "./client";
import type { TelegramConfig, TelegramEventKey } from "./config";
import { normalizeTelegramConfig, validateTelegramConfig } from "./config";

type TelegramEventData = {
  taskTitle: string;
  taskNumber: number | null;
  projectName: string;
  taskUrl: string | null;
  actorName: string | null;
  status: string | null;
  priority: string | null;
};

function isEnabled(config: TelegramConfig, key: TelegramEventKey): boolean {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function redactBotToken(botToken: string): string {
  const [prefix, suffix = ""] = botToken.split(":", 2);
  if (!suffix) {
    return "redacted";
  }

  return `${prefix}:${
    suffix.length > 8 ? `${suffix.slice(0, 4)}…${suffix.slice(-4)}` : "••••"
  }`;
}

function getSafeTelegramTargetIdentifier(config: TelegramConfig): string {
  const hash = createHash("sha256")
    .update(`${config.chatId}:${config.threadId ?? "none"}`)
    .digest("hex")
    .slice(0, 12);

  return `tg:${hash}`;
}

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

async function getTelegramEventData(
  taskId: string,
  projectId: string,
  userId: string | null,
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
    actorName: user?.name ?? null,
    status: taskRow.status,
    priority: taskRow.priority,
  };
}

async function sendTelegramMessage(
  config: TelegramConfig,
  title: string,
  body: string,
  data: TelegramEventData,
): Promise<void> {
  const issueKey =
    data.taskNumber !== null ? `#${data.taskNumber}` : "Task update";
  const taskLabel = `${issueKey} ${data.taskTitle}`;
  const escapedTaskLabel = escapeHtml(taskLabel);
  const taskLine = data.taskUrl
    ? `<a href="${escapeHtml(data.taskUrl)}">${escapedTaskLabel}</a>`
    : escapedTaskLabel;

  const lines = [
    `<b>${escapeHtml(title)}</b>`,
    escapeHtml(body),
    "",
    `<b>Task:</b> ${taskLine}`,
    `<b>Project:</b> ${escapeHtml(data.projectName)}`,
    `<b>Status:</b> ${escapeHtml(toSentenceCase(data.status))}`,
    `<b>Priority:</b> ${escapeHtml(toSentenceCase(data.priority))}`,
    `<b>Triggered by:</b> ${escapeHtml(data.actorName ?? "Kaneo")}`,
  ];

  try {
    await postToTelegram(config.botToken, {
      chat_id: config.chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: false,
      message_thread_id: config.threadId,
    });
  } catch (error) {
    console.error("sendTelegramMessage postToTelegram failed", {
      error,
      botToken: redactBotToken(config.botToken),
      telegramTarget: getSafeTelegramTargetIdentifier(config),
      taskUrl: data.taskUrl,
    });
  }
}

type TelegramMessageContent = {
  title: string;
  body: string;
};

async function runTelegramHandler(
  context: PluginContext,
  event: {
    taskId: string;
    projectId: string;
    userId: string | null;
  },
  featureKey: TelegramEventKey,
  buildMessage: () => TelegramMessageContent,
): Promise<void> {
  const validation = await validateTelegramConfig(context.config);
  if (!validation.valid) {
    console.error("Invalid Telegram plugin config; skipping event dispatch", {
      errors: validation.errors,
      config: context.config,
      featureKey,
      projectId: event.projectId,
      taskId: event.taskId,
    });
    return;
  }

  const config = normalizeTelegramConfig(context.config as TelegramConfig);
  if (!isEnabled(config, featureKey)) return;

  const data = await getTelegramEventData(
    event.taskId,
    event.projectId,
    event.userId,
  );
  if (!data) return;

  const { title, body } = buildMessage();
  await sendTelegramMessage(config, title, body, data);
}

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskCreated", () => ({
    title: "New task created",
    body: `A new task was added: ${event.title}`,
  }));
}

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskStatusChanged", () => ({
    title: "Task status changed",
    body: `${event.title} moved from ${toSentenceCase(event.oldStatus)} to ${toSentenceCase(event.newStatus)}.`,
  }));
}

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskPriorityChanged", () => ({
    title: "Task priority changed",
    body: `${event.title} changed from ${toSentenceCase(event.oldPriority)} to ${toSentenceCase(event.newPriority)}.`,
  }));
}

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskTitleChanged", () => ({
    title: "Task title changed",
    body: `Task renamed from ${truncate(event.oldTitle, 120)} to ${truncate(event.newTitle, 120)}.`,
  }));
}

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskDescriptionChanged", () => ({
    title: "Task description changed",
    body: `The task description was updated${event.newDescription ? `: ${truncate(event.newDescription.replace(/\s+/g, " "), 160)}` : "."}`,
  }));
}

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskCommentCreated", () => ({
    title: "New task comment",
    body: truncate(event.comment.replace(/\s+/g, " "), 200),
  }));
}
