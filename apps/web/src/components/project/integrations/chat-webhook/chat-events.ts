import type { EventChecklistItem } from "@/components/project/integrations/event-checklist/event-checklist-item";

export type ChatEvents = {
  taskCreated: boolean;
  taskStatusChanged: boolean;
  taskPriorityChanged: boolean;
  taskTitleChanged: boolean;
  taskDescriptionChanged: boolean;
  taskCommentCreated: boolean;
};

export const CHAT_EVENT_ITEMS: EventChecklistItem<keyof ChatEvents>[] = [
  {
    id: "taskCreated",
    labelKey: "settings:chatIntegrations.events.taskCreated",
  },
  {
    id: "taskStatusChanged",
    labelKey: "settings:chatIntegrations.events.taskStatusChanged",
  },
  {
    id: "taskPriorityChanged",
    labelKey: "settings:chatIntegrations.events.taskPriorityChanged",
  },
  {
    id: "taskTitleChanged",
    labelKey: "settings:chatIntegrations.events.taskTitleChanged",
  },
  {
    id: "taskDescriptionChanged",
    labelKey: "settings:chatIntegrations.events.taskDescriptionChanged",
  },
  {
    id: "taskCommentCreated",
    labelKey: "settings:chatIntegrations.events.taskCommentCreated",
  },
];

export function toChatEvents(events?: Partial<ChatEvents> | null): ChatEvents {
  return {
    taskCreated: events?.taskCreated ?? true,
    taskStatusChanged: events?.taskStatusChanged ?? true,
    taskPriorityChanged: events?.taskPriorityChanged ?? false,
    taskTitleChanged: events?.taskTitleChanged ?? false,
    taskDescriptionChanged: events?.taskDescriptionChanged ?? false,
    taskCommentCreated: events?.taskCommentCreated ?? true,
  };
}
