import messages from "../../../../../i18n/en-US.json";
import { fillMessage } from "./fill-message";

export type PreviewNotification = {
  id: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  taskId: string;
  title: string;
  content: string;
};

const events = messages.notifications.events;

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

// Jim's notifications, written with the app's own notification copy.
export const MOCK_NOTIFICATIONS: PreviewNotification[] = [
  {
    id: "n-1",
    type: "task_mention",
    isRead: false,
    createdAt: minutesAgo(12),
    taskId: "t-105",
    title: fillMessage(events.task_mention.title, {
      mentionerName: "Dwight Schrute",
    }),
    content: fillMessage(events.task_mention.content, {
      mentionerName: "Dwight Schrute",
      taskTitle: "Review Dwight's beet farm expense report",
    }),
  },
  {
    id: "n-2",
    type: "task_comment",
    isRead: false,
    createdAt: minutesAgo(48),
    taskId: "t-203",
    title: fillMessage(events.task_comment.title, {
      commenterName: "Michael Scott",
    }),
    content: fillMessage(events.task_comment.content, {
      taskTitle: "Review Golden Face's villain monologue",
      commentPreview: "Needs more menace. Way more menace.",
    }),
  },
  {
    id: "n-3",
    type: "task_overdue",
    isRead: false,
    createdAt: minutesAgo(95),
    taskId: "t-108",
    title: events.task_overdue.title,
    content: fillMessage(events.task_overdue.content, {
      taskTitle: "Put Dwight's stapler in Jell-O",
    }),
  },
  {
    id: "n-4",
    type: "task_assignee_changed",
    isRead: true,
    createdAt: minutesAgo(60 * 26),
    taskId: "t-102",
    title: events.task_assignee_changed.title,
    content: fillMessage(events.task_assignee_changed.content, {
      taskTitle: "Negotiate new paper contract with Prince Family Paper",
    }),
  },
  {
    id: "n-5",
    type: "due_date_reminder",
    isRead: true,
    createdAt: minutesAgo(60 * 30),
    taskId: "t-203",
    title: events.due_date_reminder.title,
    content: fillMessage(events.due_date_reminder.content, {
      taskTitle: "Review Golden Face's villain monologue",
      leadTime: fillMessage(
        messages.notifications.reminderLeadTime.days_other,
        {
          count: 2,
        },
      ),
    }),
  },
  {
    id: "n-6",
    type: "task_status_changed",
    isRead: true,
    createdAt: minutesAgo(60 * 50),
    taskId: "t-105",
    title: events.task_status_changed.title,
    content: fillMessage(events.task_status_changed.content, {
      taskTitle: "Review Dwight's beet farm expense report",
      oldStatus: "In Progress",
      newStatus: "In Review",
    }),
  },
];
