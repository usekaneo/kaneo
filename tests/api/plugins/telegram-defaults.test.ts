import { describe, expect, it } from "vite-plus/test";
import {
  defaultTelegramEvents,
  normalizeTelegramConfig,
} from "../../../apps/api/src/plugins/telegram/config";

describe("Telegram event defaults", () => {
  it("keeps the assignee-changed event off for existing integrations", () => {
    expect(defaultTelegramEvents.taskAssigneeChanged).toBe(false);
    expect(
      normalizeTelegramConfig({
        botToken: `12345678:${"x".repeat(35)}`,
        chatId: "-100123",
      }).events?.taskAssigneeChanged,
    ).toBe(false);
  });
});
