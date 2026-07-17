import { describe, expect, it } from "vitest";
import type { Notification } from "@/types/notification";
import {
  getNotificationContent,
  getNotificationTitle,
} from "./notification-dropdown";

const t = (
  key: string,
  options?: Record<string, number | string | undefined>,
) => {
  if (key === "notifications:reminderLeadTime.days") {
    return `${options?.count} days`;
  }
  if (key === "notifications:events.due_date_reminder.content") {
    return `${options?.taskTitle} is due in ${options?.leadTime}`;
  }
  if (key === "notifications:events.task_comment.title") {
    return `${options?.commenterName} commented on your task`;
  }
  if (key === "notifications:events.task_comment.content") {
    return `New comment on ${options?.taskTitle}: ${options?.commentPreview}`;
  }
  return key;
};

function notification(
  type: string,
  eventData: Record<string, unknown>,
): Notification {
  return {
    id: "notification-1",
    userId: "user-1",
    title: null,
    content: null,
    type,
    eventData,
    isRead: false,
    createdAt: "2026-07-12T10:00:00.000Z",
    updatedAt: "2026-07-12T10:00:00.000Z",
  } as unknown as Notification;
}

describe("notification display content", () => {
  it("renders configured due-date lead times", () => {
    const item = notification("due_date_reminder", {
      taskTitle: "Launch website",
      leadTimeMinutes: 2880,
    });

    expect(getNotificationTitle(item, t)).toBe(
      "notifications:events.due_date_reminder.title",
    );
    expect(getNotificationContent(item, t)).toBe(
      "Launch website is due in 2 days",
    );
  });

  it("renders comment notifications with their preview", () => {
    const item = notification("task_comment", {
      taskTitle: "Launch website",
      commenterName: "Mina",
      commentPreview: "Ready for review",
    });

    expect(getNotificationTitle(item, t)).toBe("Mina commented on your task");
    expect(getNotificationContent(item, t)).toBe(
      "New comment on Launch website: Ready for review",
    );
  });
});
