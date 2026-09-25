import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
  await createWorkspaceMember();
});
afterEach(() => vi.unstubAllEnvs());
describe("Better Auth session IP with trusted transport", () => {
  it.each(["none", "127.0.0.0/8"])(
    "records transport-resolved addresses under %s policy",
    async (policy) => {
      vi.stubEnv("TRUSTED_PROXIES", policy);
      const { app } = createApp();
      const server = serve({
        fetch: app.fetch,
        hostname: "127.0.0.1",
        port: 0,
      });
      await once(server, "listening");
      try {
        const response = await fetch(
          `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/sign-in/anonymous`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Origin: "http://localhost:5173",
              "x-kaneo-client-ip": "1.2.3.4",
              "cf-connecting-ip": "5.6.7.8",
              "x-forwarded-for": "1.2.3.4, 203.0.113.9",
            },
            body: "{}",
          },
        );
        expect(response.status, await response.text()).toBe(200);
        const sessions = await db.select().from(schema.sessionTable);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].ipAddress).toBe(
          policy === "none" ? "127.0.0.1" : "203.0.113.9",
        );
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );
});
