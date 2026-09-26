import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/api/src/database", () => ({ default: {} }));

import {
  assertTelegramServerChange,
  buildNextTelegramConfigFromPatch,
} from "../../../apps/api/src/telegram-integration/controllers/telegram-controller";

const current = {
  botToken: `12345678:${"x".repeat(35)}`,
  chatId: "chat",
  serverUrl: "https://tg.example.com",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Telegram server URL patch", () => {
  it("keeps the saved server when the patch omits it", () => {
    expect(
      buildNextTelegramConfigFromPatch({ chatId: "other" }, current).serverUrl,
    ).toBe("https://tg.example.com");
  });

  it("goes back to the official server on null", () => {
    expect(
      buildNextTelegramConfigFromPatch({ serverUrl: null }, current).serverUrl,
    ).toBeUndefined();
  });
});

describe("assertTelegramServerChange", () => {
  it("asks for the bot token when the server changes", () => {
    expect(() =>
      assertTelegramServerChange(
        { ...current, serverUrl: "https://evil.example.com" },
        current,
        false,
      ),
    ).toThrow("Enter the bot token again");
    expect(() =>
      assertTelegramServerChange(
        { ...current, serverUrl: undefined },
        current,
        false,
      ),
    ).toThrow("Enter the bot token again");
  });

  it("allows a server change together with the token", () => {
    expect(() =>
      assertTelegramServerChange(
        { ...current, serverUrl: "https://tg2.example.com" },
        current,
        true,
      ),
    ).not.toThrow();
  });

  it("lets other fields change without the token", () => {
    expect(() =>
      assertTelegramServerChange({ ...current, chatId: "2" }, current, false),
    ).not.toThrow();
  });

  it("refuses plain http unless private destinations are allowed", () => {
    const next = { ...current, serverUrl: "http://127.0.0.1:8081" };
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "false");
    expect(() => assertTelegramServerChange(next, null, true)).toThrow(
      "must use https",
    );
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    expect(() => assertTelegramServerChange(next, null, true)).not.toThrow();
  });
});
