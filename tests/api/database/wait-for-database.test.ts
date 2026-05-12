import { describe, expect, it, vi } from "vitest";
import { waitForDatabase } from "../../../apps/api/src/database/wait-for-database";

describe("wait-for-database", () => {
  it("returns on the first successful query", async () => {
    const query = vi.fn().mockResolvedValue(undefined);

    await waitForDatabase({
      query,
      sleep: async () => undefined,
      maxAttempts: 3,
    });

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures until the query succeeds", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error("getaddrinfo EAI_AGAIN postgres"))
      .mockRejectedValueOnce(new Error("getaddrinfo EAI_AGAIN postgres"))
      .mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await waitForDatabase({
      query,
      sleep,
      maxAttempts: 3,
      retryDelayMs: 25,
    });

    expect(query).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 25);
    expect(sleep).toHaveBeenNthCalledWith(2, 25);
  });

  it("throws the last error after exhausting all retries", async () => {
    const finalError = new Error("getaddrinfo EAI_AGAIN postgres");
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockRejectedValueOnce(finalError);

    await expect(
      waitForDatabase({
        query,
        sleep: async () => undefined,
        maxAttempts: 2,
      }),
    ).rejects.toThrow("getaddrinfo EAI_AGAIN postgres");

    expect(query).toHaveBeenCalledTimes(2);
  });
});
