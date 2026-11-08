import type {
  PluginContext,
  TaskAssigneeChangedEvent,
  TaskCommentCreatedEvent,
  TaskCreatedEvent,
  TaskDescriptionChangedEvent,
  TaskPriorityChangedEvent,
  TaskStatusChangedEvent,
  TaskTitleChangedEvent,
} from "../types";
import type { TelegramConfig, TelegramEventKey } from "./config";
import { normalizeTelegramConfig, validateTelegramConfig } from "./config";
import { getTelegramEventData } from "./event-data";
import { toSentenceCase, truncate } from "./format";
import { sendTelegramMessage } from "./message";

type TelegramHandlerTargets = {
  actorId: string | null;
  assigneeId: string | null;
};

function isEnabled(config: TelegramConfig, key: TelegramEventKey): boolean {
  return config.events?.[key] ?? false;
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
  },
  featureKey: TelegramEventKey,
  targets: TelegramHandlerTargets,
  buildMessage: () => TelegramMessageContent,
): Promise<void> {
  const validation = validateTelegramConfig(context.config);
  if (!validation.valid) {
    console.error("Invalid Telegram plugin config; skipping event dispatch", {
      reason: "Invalid configuration",
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
    targets.actorId,
    targets.assigneeId,
  );
  if (!data) return;

  const { title, body } = buildMessage();
  await sendTelegramMessage(config, title, body, data);
}

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(
    context,
    event,
    "taskCreated",
    { actorId: event.actorId ?? null, assigneeId: event.userId || null },
    () => ({
      title: "New task created",
      body: `A new task was added: ${event.title}`,
    }),
  );
}

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(
    context,
    event,
    "taskStatusChanged",
    { actorId: event.userId, assigneeId: null },
    () => ({
      title: "Task status changed",
      body: `${event.title} moved from ${toSentenceCase(event.oldStatus)} to ${toSentenceCase(event.newStatus)}.`,
    }),
  );
}

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(
    context,
    event,
    "taskPriorityChanged",
    { actorId: event.userId, assigneeId: null },
    () => ({
      title: "Task priority changed",
      body: `${event.title} changed from ${toSentenceCase(event.oldPriority)} to ${toSentenceCase(event.newPriority)}.`,
    }),
  );
}

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(
    context,
    event,
    "taskTitleChanged",
    { actorId: event.userId, assigneeId: null },
    () => ({
      title: "Task title changed",
      body: `Task renamed from ${truncate(event.oldTitle, 120)} to ${truncate(event.newTitle, 120)}.`,
    }),
  );
}

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(
    context,
    event,
    "taskDescriptionChanged",
    { actorId: event.userId, assigneeId: null },
    () => ({
      title: "Task description changed",
      body: `The task description was updated${event.newDescription ? `: ${truncate(event.newDescription.replace(/\s+/g, " "), 160)}` : "."}`,
    }),
  );
}

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(
    context,
    event,
    "taskCommentCreated",
    { actorId: event.userId, assigneeId: null },
    () => ({
      title: "New task comment",
      body: truncate(event.comment.replace(/\s+/g, " "), 200),
    }),
  );
}

export async function handleTaskAssigneeChanged(
  event: TaskAssigneeChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(
    context,
    event,
    "taskAssigneeChanged",
    { actorId: event.userId, assigneeId: event.newAssigneeId },
    () => ({
      title: "Task assignee changed",
      body: `${event.title} was assigned to ${event.newAssignee || "someone"}.`,
    }),
  );
}
