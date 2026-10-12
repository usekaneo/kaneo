import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import NotificationEmail from "./notification";

describe("NotificationEmail", () => {
  it("renders Japanese chrome for a Japanese locale", async () => {
    const html = await render(
      createElement(NotificationEmail, {
        title: "タスクが割り当てられました",
        message: "デザイン案の確認をお願いします。",
        actionUrl: "https://kaneo.example/task/1",
        locale: "ja-JP",
      }),
    );
    expect(html).toContain("Kaneo で開く");
    expect(html).toContain("配信設定に一致する通知がありました。");
  });

  it("renders Traditional Chinese chrome for a zh-TW locale", async () => {
    const html = await render(
      createElement(NotificationEmail, {
        title: "你被指派了一項任務",
        message: "請確認設計稿。",
        actionUrl: "https://kaneo.example/task/1",
        locale: "zh-TW",
      }),
    );
    expect(html).toContain("在 Kaneo 中開啟");
    expect(html).toContain("有一則通知符合你的通知設定。");
  });

  it("renders the task card with localized priority and due date", async () => {
    const html = await render(
      createElement(NotificationEmail, {
        title: "Task assigned to you",
        message: "You were assigned to Redesign emails.",
        actionUrl: "https://kaneo.example/task/1",
        breadcrumb: "Acme / Website",
        task: {
          ticket: "KAN-128",
          title: "Redesign emails",
          labels: [{ name: "Design", color: "#8E51FF" }],
          priority: "high",
          dueDate: new Date("2026-10-14T00:00:00Z"),
          dueStatus: "due-soon",
          column: { name: "In progress", icon: "circle-dot", count: 3 },
        },
      }),
    );
    expect(html).toContain("KAN-128");
    expect(html).toContain("Design");
    expect(html).toContain('alt="High priority"');
    expect(html).toContain("Oct 14");
    expect(html).toContain("In progress");
    expect(html).toContain("Open task");
  });
});
