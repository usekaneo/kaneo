import { afterEach, describe, expect, it, vi } from "vitest";
import { postToTelegram } from "../../../apps/api/src/plugins/telegram/client";
import {
  normalizeTelegramConfig,
  validateTelegramConfig,
} from "../../../apps/api/src/plugins/telegram/config";

const token = `12345678:${"x".repeat(35)}`;

function okFetch() {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Telegram server URL config", () => {
  it("accepts a server with a path prefix and drops the trailing slash", () => {
    const config = normalizeTelegramConfig({
      botToken: token,
      chatId: "chat",
      serverUrl: " https://tg.example.com/proxy/ ",
    });
    expect(config.serverUrl).toBe("https://tg.example.com/proxy");
    expect(validateTelegramConfig(config).valid).toBe(true);
  });

  it("keeps the official server when the field is empty", () => {
    const config = normalizeTelegramConfig({
      botToken: token,
      chatId: "chat",
      serverUrl: "  ",
    });
    expect(config.serverUrl).toBeUndefined();
  });

  it.each([
    "https://tg.example.com/?x=1",
    "https://tg.example.com/#top",
    "https://user:pass@tg.example.com",
    "ftp://tg.example.com",
    "not a url",
  ])("rejects %s", (serverUrl) => {
    expect(
      validateTelegramConfig({ botToken: token, chatId: "chat", serverUrl })
        .valid,
    ).toBe(false);
  });
});

describe("postToTelegram server URL", () => {
  it("uses api.telegram.org by default", async () => {
    const fetchMock = okFetch();
    await postToTelegram(token, { chat_id: "chat", text: "hi" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://api.telegram.org/bot${token}/sendMessage`,
    );
  });

  it("sends to the custom server", async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    const fetchMock = okFetch();
    await postToTelegram(
      token,
      { chat_id: "chat", text: "hi" },
      "https://tg.example.com/proxy",
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://tg.example.com/proxy/bot${token}/sendMessage`,
    );
  });

  it("refuses plain http to a custom server before sending the token", async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "false");
    const fetchMock = okFetch();
    await expect(
      postToTelegram(
        token,
        { chat_id: "chat", text: "hi" },
        "http://tg.example.com",
      ),
    ).rejects.toMatchObject({ reason: "destination" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a custom server on a private address", async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "false");
    const fetchMock = okFetch();
    await expect(
      postToTelegram(
        token,
        { chat_id: "chat", text: "hi" },
        "https://127.0.0.1:8081",
      ),
    ).rejects.toMatchObject({ reason: "destination" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
