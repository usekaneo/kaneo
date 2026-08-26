import { describe, expect, it } from "vitest";
import { normalizeGoogleChatConfig, validateGoogleChatConfig } from "./config";

const webhookUrl =
  "https://chat.googleapis.com/v1/spaces/AAAA-test/messages?key=api-key&token=webhook-token";

describe("Google Chat integration config", () => {
  it("accepts a Google Chat incoming webhook", async () => {
    await expect(validateGoogleChatConfig({ webhookUrl })).resolves.toEqual({
      valid: true,
    });
  });

  it("rejects URLs that are not Google Chat incoming webhooks", async () => {
    const result = await validateGoogleChatConfig({
      webhookUrl: "https://example.com/webhook",
    });

    expect(result.valid).toBe(false);
  });

  it("applies defaults while preserving selected event settings", () => {
    const config = normalizeGoogleChatConfig({
      webhookUrl,
      channelName: "  Team updates  ",
      events: { taskCreated: false },
    });

    expect(config.channelName).toBe("Team updates");
    expect(config.events).toMatchObject({
      taskCreated: false,
      taskStatusChanged: true,
      taskCommentCreated: true,
    });
  });
});
