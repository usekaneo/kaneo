import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth-service.js";

const {
  loadCredentialsMock,
  clearCredentialsMock,
  saveCredentialsMock,
  requestDeviceCodeMock,
  pollDeviceAccessTokenMock,
  openMock,
} = vi.hoisted(() => ({
  loadCredentialsMock: vi.fn(),
  clearCredentialsMock: vi.fn(),
  saveCredentialsMock: vi.fn(),
  requestDeviceCodeMock: vi.fn(),
  pollDeviceAccessTokenMock: vi.fn(),
  openMock: vi.fn(),
}));

vi.mock("./token-store.js", () => ({
  loadCredentials: loadCredentialsMock,
  clearCredentials: clearCredentialsMock,
  saveCredentials: saveCredentialsMock,
}));

vi.mock("./device-flow.js", () => ({
  requestDeviceCode: requestDeviceCodeMock,
  pollDeviceAccessToken: pollDeviceAccessTokenMock,
}));

vi.mock("open", () => ({
  default: openMock,
}));

describe("AuthService", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    loadCredentialsMock.mockReset();
    clearCredentialsMock.mockReset();
    saveCredentialsMock.mockReset();
    requestDeviceCodeMock.mockReset();
    pollDeviceAccessTokenMock.mockReset();
    openMock.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("reuses the cached token when validation succeeds", async () => {
    loadCredentialsMock.mockResolvedValue({
      version: 1,
      baseUrl: "https://api.example.com",
      clientId: "kaneo-mcp",
      accessToken: "cached-token",
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "user-1" } }), {
        status: 200,
      }),
    ) as typeof fetch;

    const service = new AuthService({
      baseUrl: "https://api.example.com",
      clientId: "kaneo-mcp",
    });

    await expect(service.getAccessToken()).resolves.toBe("cached-token");
    expect(clearCredentialsMock).not.toHaveBeenCalled();
    expect(requestDeviceCodeMock).not.toHaveBeenCalled();
  });

  it("keeps the cached token when validation cannot confirm validity", async () => {
    loadCredentialsMock.mockResolvedValue({
      version: 1,
      baseUrl: "https://api.example.com",
      clientId: "kaneo-mcp",
      accessToken: "cached-token",
    });
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        new Error("temporary network failure"),
      ) as typeof fetch;

    const service = new AuthService({
      baseUrl: "https://api.example.com",
      clientId: "kaneo-mcp",
    });

    await expect(service.getAccessToken()).resolves.toBe("cached-token");
    expect(clearCredentialsMock).not.toHaveBeenCalled();
    expect(requestDeviceCodeMock).not.toHaveBeenCalled();
  });

  it("clears the cached token and starts device auth after a 401", async () => {
    loadCredentialsMock.mockResolvedValue({
      version: 1,
      baseUrl: "https://api.example.com",
      clientId: "kaneo-mcp",
      accessToken: "expired-token",
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      }),
    ) as typeof fetch;
    requestDeviceCodeMock.mockResolvedValue({
      device_code: "device-code",
      user_code: "ABCD-EFGH",
      verification_uri: "https://verify.example.com",
      interval: 5,
    });
    pollDeviceAccessTokenMock.mockResolvedValue("fresh-token");

    const service = new AuthService({
      baseUrl: "https://api.example.com",
      clientId: "kaneo-mcp",
    });

    await expect(service.getAccessToken()).resolves.toBe("fresh-token");
    expect(clearCredentialsMock).toHaveBeenCalledTimes(1);
    expect(requestDeviceCodeMock).toHaveBeenCalledWith(
      "https://api.example.com",
      "kaneo-mcp",
    );
    expect(saveCredentialsMock).toHaveBeenCalledWith({
      version: 1,
      baseUrl: "https://api.example.com",
      clientId: "kaneo-mcp",
      accessToken: "fresh-token",
    });
  });
});
