import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";

describe("API integration: health", () => {
  it("responds with ok on /api/health", async () => {
    const { app } = createApp();

    const response = await app.request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
