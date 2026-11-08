import {
  CHAT_EVENT_ITEMS,
  type ChatEvents,
  toChatEvents,
} from "@/components/project/integrations/chat-webhook/chat-events";
import type { EventChecklistItem } from "@/components/project/integrations/event-checklist/event-checklist-item";

export type TelegramEvents = ChatEvents & {
  taskAssigneeChanged: boolean;
};

export const TELEGRAM_EVENT_ITEMS: EventChecklistItem<keyof TelegramEvents>[] =
  [
    ...CHAT_EVENT_ITEMS,
    {
      id: "taskAssigneeChanged",
      labelKey: "settings:telegramIntegration.events.taskAssigneeChanged",
    },
  ];

export function toTelegramEvents(
  events?: Partial<TelegramEvents> | null,
): TelegramEvents {
  return {
    ...toChatEvents(events),
    taskAssigneeChanged: events?.taskAssigneeChanged ?? false,
  };
}
