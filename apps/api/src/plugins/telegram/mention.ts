import { escapeHtml } from "./html";

export type TelegramIdentity = {
  name: string;
  telegramHandle: string | null;
};

export function formatTelegramMention({
  name,
  telegramHandle,
}: TelegramIdentity): string {
  if (!telegramHandle) return escapeHtml(name);
  if (/^\d+$/.test(telegramHandle)) {
    return `<a href="tg://user?id=${telegramHandle}">${escapeHtml(name)}</a>`;
  }
  return `@${escapeHtml(telegramHandle)}`;
}
