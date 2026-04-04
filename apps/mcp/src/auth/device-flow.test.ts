import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollDeviceAccessToken, requestDeviceCode } from "./device-flow.js";

describe("requestDeviceCode", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts the client id and returns the parsed device code response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          device_code: "device-code",
          user_code: "user-code",
          verification_uri: "https://verify.example.com",
          interval: 5,
          expires_in: 1800,
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await requestDeviceCode(
      "https://api.example.com",
      "kaneo-mcp",
    );

    expect(result.device_code).toBe("device-code");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/auth/device/code",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: "kaneo-mcp" }),
      },
    );
  });

  it("throws when the response body is missing the device code", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user_code: "missing-device-code" }), {
        status: 200,
      }),
    ) as typeof fetch;

    await expect(
      requestDeviceCode("https://api.example.com", "kaneo-mcp"),
    ).rejects.toThrow(/unexpected response/);
  });
});

describe("pollDeviceAccessToken", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps polling through authorization_pending until an access token is returned", async () => {
    const log = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "authorization_pending" }), {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-123" }), {
          status: 200,
        }),
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const promise = pollDeviceAccessToken(
      "https://api.example.com",
      "kaneo-mcp",
      "device-code",
      1,
      { log },
    );

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("token-123");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith("Waiting for device approval…");
  });

  it("increases the polling interval after slow_down", async () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "slow_down" }), {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-123" }), {
          status: 200,
        }),
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const promise = pollDeviceAccessToken(
      "https://api.example.com",
      "kaneo-mcp",
      "device-code",
      1,
    );

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("token-123");
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 6000);
  });

  it("throws a helpful error when authorization is denied", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "access_denied" }), {
        status: 400,
      }),
    ) as typeof fetch;

    await expect(
      pollDeviceAccessToken(
        "https://api.example.com",
        "kaneo-mcp",
        "device-code",
        1,
      ),
    ).rejects.toThrow("Device authorization was denied.");
  });
});
