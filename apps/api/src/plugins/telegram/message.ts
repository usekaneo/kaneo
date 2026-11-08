import { createHash } from "node:crypto";
import { safeOutboundError } from "../../utils/outbound-request";
import { postToTelegram } from "./client";
import type { TelegramConfig } from "./config";
import { toSentenceCase } from "./format";
import { escapeHtml } from "./html";
import { formatTelegramMention, type TelegramIdentity } from "./mention";

export type TelegramEventData = {
  taskTitle: string;
  taskNumber: number | null;
  projectName: string;
  taskUrl: string | null;
  actorName: string | null;
  assignee: TelegramIdentity | null;
  status: string | null;
  priority: string | null;
};

function getSafeTelegramTargetIdentifier(config: TelegramConfig): string {
  const hash = createHash("sha256")
    .update(`${config.chatId}:${config.threadId ?? "none"}`)
    .digest("hex")
    .slice(0, 12);

  return `tg:${hash}`;
}

export function buildTelegramMessage(
  title: string,
  body: string,
  data: TelegramEventData,
): string {
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
  ];

  if (data.assignee) {
    lines.push(`<b>Assignee:</b> ${formatTelegramMention(data.assignee)}`);
  }
  lines.push(`<b>Triggered by:</b> ${escapeHtml(data.actorName ?? "Kaneo")}`);

  return lines.join("\n");
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  title: string,
  body: string,
  data: TelegramEventData,
): Promise<void> {
  try {
    await postToTelegram(config.botToken, {
      chat_id: config.chatId,
      text: buildTelegramMessage(title, body, data),
      parse_mode: "HTML",
      disable_web_page_preview: false,
      message_thread_id: config.threadId,
    });
  } catch (error) {
    console.error("sendTelegramMessage postToTelegram failed", {
      error: safeOutboundError(error),
      telegramTarget: getSafeTelegramTargetIdentifier(config),
      taskUrl: data.taskUrl,
    });
  }
}
