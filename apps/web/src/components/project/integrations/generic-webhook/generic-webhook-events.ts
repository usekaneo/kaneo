import type { EventChecklistItem } from "@/components/project/integrations/event-checklist/event-checklist-item";

export type GenericWebhookEvents = {
  taskCreated: boolean;
  taskStatusChanged: boolean;
  taskPriorityChanged: boolean;
  taskTitleChanged: boolean;
  taskDescriptionChanged: boolean;
  taskCommentCreated: boolean;
  taskDeleted: boolean;
  taskMoved: boolean;
  taskDueDateChanged: boolean;
  taskAssigneeChanged: boolean;
  taskUnassigned: boolean;
  dueDateReminder: boolean;
};

export const GENERIC_WEBHOOK_EVENT_ITEMS: EventChecklistItem<
  keyof GenericWebhookEvents
>[] = [
  {
    id: "taskCreated",
    labelKey: "settings:genericWebhookIntegration.events.taskCreated",
  },
  {
    id: "taskDeleted",
    labelKey: "settings:genericWebhookIntegration.events.taskDeleted",
  },
  {
    id: "taskMoved",
    labelKey: "settings:genericWebhookIntegration.events.taskMoved",
  },
  {
    id: "taskStatusChanged",
    labelKey: "settings:genericWebhookIntegration.events.taskStatusChanged",
  },
  {
    id: "taskPriorityChanged",
    labelKey: "settings:genericWebhookIntegration.events.taskPriorityChanged",
  },
  {
    id: "taskTitleChanged",
    labelKey: "settings:genericWebhookIntegration.events.taskTitleChanged",
  },
  {
    id: "taskDescriptionChanged",
    labelKey:
      "settings:genericWebhookIntegration.events.taskDescriptionChanged",
  },
  {
    id: "taskAssigneeChanged",
    labelKey: "settings:genericWebhookIntegration.events.taskAssigneeChanged",
  },
  {
    id: "taskUnassigned",
    labelKey: "settings:genericWebhookIntegration.events.taskUnassigned",
  },
  {
    id: "taskDueDateChanged",
    labelKey: "settings:genericWebhookIntegration.events.taskDueDateChanged",
  },
  {
    id: "taskCommentCreated",
    labelKey: "settings:genericWebhookIntegration.events.taskCommentCreated",
  },
  {
    id: "dueDateReminder",
    labelKey: "settings:genericWebhookIntegration.events.dueDateReminder",
  },
];

export function toGenericWebhookEvents(
  events?: Partial<GenericWebhookEvents> | null,
): GenericWebhookEvents {
  return {
    taskCreated: events?.taskCreated ?? true,
    taskStatusChanged: events?.taskStatusChanged ?? true,
    taskPriorityChanged: events?.taskPriorityChanged ?? false,
    taskTitleChanged: events?.taskTitleChanged ?? false,
    taskDescriptionChanged: events?.taskDescriptionChanged ?? false,
    taskCommentCreated: events?.taskCommentCreated ?? true,
    taskDeleted: events?.taskDeleted ?? false,
    taskMoved: events?.taskMoved ?? false,
    taskDueDateChanged: events?.taskDueDateChanged ?? false,
    taskAssigneeChanged: events?.taskAssigneeChanged ?? false,
    taskUnassigned: events?.taskUnassigned ?? false,
    dueDateReminder: events?.dueDateReminder ?? false,
  };
}
