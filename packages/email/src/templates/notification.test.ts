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
});
