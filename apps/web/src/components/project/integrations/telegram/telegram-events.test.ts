import { describe, expect, it } from "vite-plus/test";
import { CHAT_EVENT_ITEMS } from "@/components/project/integrations/chat-webhook/chat-events";
import { TELEGRAM_EVENT_ITEMS, toTelegramEvents } from "./telegram-events";

describe("telegram events", () => {
  it("adds the Telegram-only event without touching the shared list", () => {
    expect(TELEGRAM_EVENT_ITEMS.map((item) => item.id)).toContain(
      "taskAssigneeChanged",
    );
    expect(CHAT_EVENT_ITEMS.map((item) => item.id)).not.toContain(
      "taskAssigneeChanged",
    );
  });

  it("defaults the new event to off", () => {
    expect(toTelegramEvents()).toMatchObject({ taskAssigneeChanged: false });
    expect(toTelegramEvents({ taskAssigneeChanged: true })).toMatchObject({
      taskAssigneeChanged: true,
    });
  });
});
