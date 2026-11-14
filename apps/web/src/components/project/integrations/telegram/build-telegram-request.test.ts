import { describe, expect, it } from "vite-plus/test";
import { toChatEvents } from "@/components/project/integrations/chat-webhook/chat-events";
import { buildTelegramRequest } from "./build-telegram-request";
import type { TelegramFormValues } from "./telegram-form-values";

const token = "123456789:AAExampleBotTokenValue1234";

function values(overrides: Partial<TelegramFormValues> = {}) {
  return {
    botToken: token,
    serverUrl: "",
    chatId: "-1001234567890",
    threadId: "",
    chatLabel: "",
    events: toChatEvents(),
    ...overrides,
  };
}

describe("buildTelegramRequest", () => {
  it("requires a chat ID", () => {
    expect(buildTelegramRequest(values({ chatId: "  " }), false)).toEqual({
      kind: "invalid",
      field: "chatId",
      messageKey: "settings:telegramIntegration.validation.chatIdRequired",
    });
  });

  it("rejects a topic ID that is not a positive number", () => {
    expect(
      buildTelegramRequest(values({ threadId: "0" }), false),
    ).toMatchObject({ kind: "invalid", field: "threadId" });
    expect(
      buildTelegramRequest(values({ threadId: "abc" }), true),
    ).toMatchObject({ kind: "invalid", field: "threadId" });
  });

  it("requires a valid bot token before connecting", () => {
    expect(buildTelegramRequest(values({ botToken: "" }), false)).toMatchObject(
      { kind: "invalid", field: "botToken" },
    );
    expect(
      buildTelegramRequest(values({ botToken: "not-a-token" }), true),
    ).toMatchObject({ kind: "invalid", field: "botToken" });
  });

  it("creates with optional fields left out", () => {
    expect(buildTelegramRequest(values({ threadId: "42" }), false)).toEqual({
      kind: "create",
      data: {
        botToken: token,
        chatId: "-1001234567890",
        threadId: 42,
        chatLabel: undefined,
        events: toChatEvents(),
      },
    });
  });

  it("keeps the saved token and clears optional fields on update", () => {
    expect(
      buildTelegramRequest(values({ botToken: "", chatLabel: "  " }), true),
    ).toEqual({
      kind: "update",
      json: {
        botToken: undefined,
        chatId: "-1001234567890",
        threadId: null,
        chatLabel: null,
        events: toChatEvents(),
      },
    });
  });

  it("rejects a server URL without http or https", () => {
    expect(
      buildTelegramRequest(values({ serverUrl: "tg.example.com" }), false),
    ).toEqual({
      kind: "invalid",
      field: "serverUrl",
      messageKey: "settings:telegramIntegration.validation.serverUrlInvalid",
    });
  });

  it("creates with the server URL without trailing slashes", () => {
    expect(
      buildTelegramRequest(
        values({ serverUrl: " https://tg.example.com/proxy/ " }),
        false,
      ),
    ).toMatchObject({
      kind: "create",
      data: { serverUrl: "https://tg.example.com/proxy" },
    });
  });

  it("requires the bot token to switch servers", () => {
    expect(
      buildTelegramRequest(
        values({ botToken: "", serverUrl: "https://other.example.com" }),
        true,
        "https://tg.example.com",
      ),
    ).toEqual({
      kind: "invalid",
      field: "botToken",
      messageKey:
        "settings:telegramIntegration.validation.botTokenRequiredForServer",
    });
  });

  it("sends the server URL only when it changes", () => {
    const unchanged = buildTelegramRequest(
      values({ botToken: "", serverUrl: "https://tg.example.com/" }),
      true,
      "https://tg.example.com",
    );
    expect(unchanged.kind === "update" && unchanged.json).not.toHaveProperty(
      "serverUrl",
    );
    expect(
      buildTelegramRequest(
        values({ serverUrl: "" }),
        true,
        "https://tg.example.com",
      ),
    ).toMatchObject({ kind: "update", json: { serverUrl: null } });
  });
});
