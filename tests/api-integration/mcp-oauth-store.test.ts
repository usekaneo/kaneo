import { describe, expect, it } from "vitest";
import {
  consumeState,
  deleteExpiredStates,
  getState,
  putState,
} from "../../apps/api/src/mcp/oauth-store";

describe("mcp oauth store", () => {
  it("stores and returns state by kind and key", async () => {
    const key = `client-${Date.now()}`;
    const payload = { clientId: key, redirectUris: ["https://a.example/cb"] };
    await putState("client", key, payload, new Date(Date.now() + 60_000));

    await expect(getState("client", key)).resolves.toEqual(payload);
    await expect(getState("code", key)).resolves.toBeNull();
  });

  it("consumes state exactly once", async () => {
    const key = `code-${Date.now()}`;
    const payload = { clientId: "c", userId: "u" };
    await putState("code", key, payload, new Date(Date.now() + 60_000));

    await expect(consumeState("code", key)).resolves.toEqual(payload);
    await expect(consumeState("code", key)).resolves.toBeNull();
    await expect(getState("code", key)).resolves.toBeNull();
  });

  it("treats expired rows as absent and sweeps them", async () => {
    const key = `request-${Date.now()}`;
    await putState("request", key, { clientId: "c" }, new Date(Date.now() - 1));

    await expect(getState("request", key)).resolves.toBeNull();
    await expect(consumeState("request", `${key}-other`)).resolves.toBeNull();

    await putState(
      "request",
      `${key}-expired`,
      { clientId: "c" },
      new Date(Date.now() - 1),
    );
    await deleteExpiredStates();
    await expect(getState("request", `${key}-expired`)).resolves.toBeNull();
  });
});
