import { lookup } from "node:dns/promises";
import { createHmac } from "node:crypto";
import { createServer, type Server, type IncomingHttpHeaders } from "node:http";
import { eq, sql } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { recordAdminAction } from "../../apps/api/src/admin/audit/record-admin-action";
import { sendWebhookDelivery } from "../../apps/api/src/admin/webhooks/send-webhook-delivery";
import * as claims from "../../apps/api/src/admin/webhooks/claim-webhook-delivery";
import { claimWebhookDelivery } from "../../apps/api/src/admin/webhooks/claim-webhook-delivery";
import {
  insertInstanceRole,
  signInWithRole,
  adminApi,
} from "./helpers/admin/instance-roles";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { resetTestDatabase } from "./helpers/database";

vi.mock("node:dns/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns/promises")>();
  return { ...actual, lookup: vi.fn(actual.lookup) };
});

let server: Server;
let url: string;
let status: number;
let requests: { body: string; headers: IncomingHttpHeaders }[];
let admin: Awaited<ReturnType<typeof signInWithRole>>;
let app: ReturnType<typeof createApp>["app"];
const table = schema.instanceWebhookDeliveryTable;

beforeEach(async () => {
  vi.mocked(lookup).mockReset();
  await resetTestDatabase();
  vi.stubEnv(
    "NOTIFICATION_SECRET_ENCRYPTION_KEY",
    "test-only-webhook-encryption-key",
  );
  vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
  ({ app } = createApp());
  admin = await signInWithRole(app, "admin");
  requests = [];
  status = 204;
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      requests.push({ body, headers: req.headers });
      res.writeHead(status);
      res.end(status === 204 ? undefined : "untrusted-secret-response-body");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No receiver address");
  url = `http://127.0.0.1:${address.port}/events`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function create(categories = ["user"], enabled = true) {
  const response = await admin.api("/webhooks", {
    method: "POST",
    body: { url, categories, enabled },
  });
  expect(response.status, await response.clone().text()).toBe(201);
  return response.json() as Promise<{
    webhook: { id: string };
    secret: string;
  }>;
}
async function due() {
  await db.update(table).set({ nextAttemptAt: new Date(0) });
}
async function record(
  action = "user.updated",
  database: Parameters<typeof recordAdminAction>[1] = db,
) {
  await recordAdminAction(
    {
      actorUserId: admin.userId,
      action,
      targetType: "user",
      targetId: "target",
      metadata: {
        name: "Changed",
        password: "must-not-stream",
        token: "must-not-stream",
      },
      ipAddress: "203.0.113.2",
    },
    database,
  );
}

async function waitForWebhookLock() {
  await expect
    .poll(async () => {
      const result = await db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND state = 'active'
        AND wait_event_type = 'Lock' AND query LIKE '%instance_webhook%'
    `);
      return result.rows[0]?.count;
    })
    .toBe(1);
}

describe("instance webhook administration", () => {
  it("gates every endpoint by session and instance:settings, rejecting API keys", async () => {
    const { webhook } = await create();
    const plain = await signInWithRole(app, "user");
    const { key } = await auth.api.createApiKey({
      body: { userId: admin.userId },
    });
    const routes = [
      ["GET", "/webhooks"],
      ["POST", "/webhooks"],
      ["PUT", `/webhooks/${webhook.id}`],
      ["DELETE", `/webhooks/${webhook.id}`],
      ["POST", `/webhooks/${webhook.id}/rotate-secret`],
      ["POST", `/webhooks/${webhook.id}/test`],
      ["GET", `/webhooks/${webhook.id}/deliveries`],
    ];
    for (const [method, path] of routes) {
      for (const [api, expected] of [
        [adminApi(app, {}), 401],
        [plain.api, 403],
        [adminApi(app, { "x-api-key": key }), 403],
        [adminApi(app, { authorization: `Bearer ${key}` }), 403],
      ] as const) {
        expect(
          (
            await api(path!, {
              method,
              ...(method === "POST" || method === "PUT"
                ? { body: { url, categories: ["user"], enabled: true } }
                : {}),
            })
          ).status,
          `${method} ${path}`,
        ).toBe(expected);
      }
    }
    await insertInstanceRole("webhooks-manager", ["instance:settings"]);
    const manager = await signInWithRole(app, "webhooks-manager");
    expect((await manager.api("/webhooks")).status).toBe(200);
    expect(
      (
        await manager.api(`/webhooks/${webhook.id}`, {
          method: "PUT",
          body: { url, categories: ["instance"], enabled: false },
        })
      ).status,
    ).toBe(200);
  });

  it("disables an unchanged destination during DNS failure while still validating changed URLs and re-enabling", async () => {
    const { webhook } = await create();
    const brokenUrl = "https://gone.example.test/events";
    await db
      .update(schema.instanceWebhookTable)
      .set({ url: brokenUrl })
      .where(eq(schema.instanceWebhookTable.id, webhook.id));
    await record();
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
    vi.mocked(lookup).mockRejectedValue(
      Object.assign(new Error("DNS failure"), { code: "ENOTFOUND" }),
    );
    const disabled = await admin.api(`/webhooks/${webhook.id}`, {
      method: "PUT",
      body: { url: brokenUrl, categories: ["user"], enabled: false },
    });
    expect(disabled.status).toBe(200);
    expect(lookup).not.toHaveBeenCalled();
    expect(
      await db.select().from(table).where(eq(table.state, "pending")),
    ).toEqual([]);
    for (const input of [
      {
        url: "https://other.example.test/events",
        categories: ["user"],
        enabled: false,
      },
      { url: brokenUrl, categories: ["user"], enabled: true },
    ]) {
      expect(
        (
          await admin.api(`/webhooks/${webhook.id}`, {
            method: "PUT",
            body: input,
          })
        ).status,
      ).toBe(400);
    }
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it.each(["disable", "delete"] as const)(
    "returns the normal error when a concurrent %s wins before a test enqueue",
    async (action) => {
      const { webhook } = await create();
      const { pending } = await db.transaction(async (tx) => {
        if (action === "delete") {
          await tx
            .delete(schema.instanceWebhookTable)
            .where(eq(schema.instanceWebhookTable.id, webhook.id));
        } else {
          await tx
            .update(schema.instanceWebhookTable)
            .set({ enabled: false })
            .where(eq(schema.instanceWebhookTable.id, webhook.id));
        }
        const pending = admin.api(`/webhooks/${webhook.id}/test`, {
          method: "POST",
        });
        await waitForWebhookLock();
        return { pending };
      });
      expect((await pending).status).toBe(action === "delete" ? 404 : 409);
      expect(await db.select().from(table)).toEqual([]);
    },
  );

  it("shows secrets once, encrypts storage, and audits create/update/rotate/delete without secrets", async () => {
    const { webhook, secret } = await create();
    const [stored] = await db.select().from(schema.instanceWebhookTable);
    expect(stored?.signingSecret).toMatch(/^enc:v1:/);
    expect(stored?.signingSecret).not.toContain(secret);
    const rotated = await admin.api(`/webhooks/${webhook.id}/rotate-secret`, {
      method: "POST",
    });
    expect(rotated.status).toBe(200);
    const next = (await rotated.json()) as { secret: string };
    expect(next.secret).not.toBe(secret);
    const updated = await admin.api(`/webhooks/${webhook.id}`, {
      method: "PUT",
      body: { url, categories: ["email"], enabled: false },
    });
    expect(updated.status).toBe(200);
    expect(await updated.text()).not.toContain("secret");
    const list = await admin.api("/webhooks");
    const text = await list.text();
    expect(text).not.toContain(secret);
    expect(text).not.toContain(next.secret);
    expect(text).not.toContain("signingSecret");
    expect(
      (await admin.api(`/webhooks/${webhook.id}/test`, { method: "POST" }))
        .status,
    ).toBe(409);
    expect(
      (await admin.api(`/webhooks/${webhook.id}`, { method: "DELETE" })).status,
    ).toBe(200);
    expect(await db.select().from(table)).toEqual([]);
    const audit = await readAuditLog();
    expect(audit.map((row) => row.action).sort()).toEqual([
      "webhook.created",
      "webhook.deleted",
      "webhook.secret_rotated",
      "webhook.updated",
    ]);
    expect(JSON.stringify(audit)).not.toContain(secret);
    expect(JSON.stringify(audit)).not.toContain(next.secret);
    expect(JSON.stringify(audit)).not.toContain(url);
    for (const [method, suffix] of [
      ["PUT", ""],
      ["DELETE", ""],
      ["POST", "/rotate-secret"],
      ["POST", "/test"],
      ["GET", "/deliveries"],
    ]) {
      const missing = await admin.api(`/webhooks/${webhook.id}${suffix}`, {
        method,
        ...(method === "PUT"
          ? { body: { url, categories: ["user"], enabled: true } }
          : {}),
      });
      expect(missing.status).toBe(404);
    }
  });

  it("requires encryption configuration and validates categories and destinations on create and edit", async () => {
    const { webhook } = await create();
    vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "");
    expect(
      (
        await admin.api("/webhooks", {
          method: "POST",
          body: { url, categories: ["user"], enabled: true },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await admin.api(`/webhooks/${webhook.id}/rotate-secret`, {
          method: "POST",
        })
      ).status,
    ).toBe(409);
    expect(await (await admin.api("/webhooks")).json()).toMatchObject({
      signingConfigured: false,
    });
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
    const invalid = [
      "http://127.0.0.1/events",
      "https://10.0.0.1",
      "https://[::1]",
      "http://localhost",
      "https://169.254.169.254/latest",
      "https://user:password@8.8.8.8/events",
      "file:///etc/passwd",
    ];
    for (const destination of invalid) {
      for (const [method, path] of [
        ["POST", "/webhooks"],
        ["PUT", `/webhooks/${webhook.id}`],
      ]) {
        const response = await admin.api(path!, {
          method,
          body: { url: destination, categories: ["user"], enabled: true },
        });
        expect(response.status, destination).toBe(400);
      }
    }
    for (const categories of [[], ["unknown"]]) {
      expect(
        (
          await admin.api("/webhooks", {
            method: "POST",
            body: { url, categories, enabled: true },
          })
        ).status,
      ).toBe(400);
    }
    vi.stubEnv("NODE_ENV", "production");
    expect(
      (
        await admin.api(`/webhooks/${webhook.id}`, {
          method: "PUT",
          body: { url: "http://8.8.8.8", categories: ["user"], enabled: true },
        })
      ).status,
    ).toBe(400);
  });
});

describe("instance webhook delivery", () => {
  it("cancels an uncommitted enqueue even if it commits after disable and re-enable", async () => {
    const { webhook } = await create();
    await db.transaction(async (tx) => {
      await record("user.updated", tx);
      for (const enabled of [false, true]) {
        const response = await admin.api(`/webhooks/${webhook.id}`, {
          method: "PUT",
          body: { url, categories: ["user"], enabled },
        });
        expect(response.status).toBe(200);
      }
    });
    expect(await sendWebhookDelivery()).toBe(false);
    expect(requests).toHaveLength(0);
    expect(await db.select().from(table)).toEqual([
      expect.objectContaining({
        state: "failed",
        errorCode: "disabled",
        attempts: 0,
      }),
    ]);
    await record();
    expect(await sendWebhookDelivery()).toBe(true);
    expect(requests).toHaveLength(1);
  });

  it("keeps events enqueued after re-enable within the enabling transaction", async () => {
    const { webhook } = await create(["webhook"], false);
    const response = await admin.api(`/webhooks/${webhook.id}`, {
      method: "PUT",
      body: { url, categories: ["webhook"], enabled: true },
    });
    expect(response.status).toBe(200);
    expect(await sendWebhookDelivery()).toBe(true);
    expect(JSON.parse(requests[0]!.body).action).toBe("webhook.updated");
  });

  it("rechecks cancellation after claiming and before sending", async () => {
    const { webhook } = await create();
    await record();
    const claim = claims.claimWebhookDelivery;
    vi.spyOn(claims, "claimWebhookDelivery").mockImplementationOnce(
      async () => {
        const job = await claim();
        for (const enabled of [false, true]) {
          expect(
            (
              await admin.api(`/webhooks/${webhook.id}`, {
                method: "PUT",
                body: { url, categories: ["user"], enabled },
              })
            ).status,
          ).toBe(200);
        }
        return job;
      },
    );
    expect(await sendWebhookDelivery()).toBe(true);
    expect(requests).toHaveLength(0);
  });

  it("preserves a committed auth change and its audit row when enqueue fails, but rolls back transactional actions", async () => {
    await create();
    const target = await signInWithRole(app, "user");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.execute(sql`ALTER TABLE instance_webhook_delivery
      ADD CONSTRAINT test_reject_queue CHECK (false) NOT VALID`);
    try {
      const response = await app.request("/api/auth/admin/update-user", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
          cookie: admin.cookies,
        },
        body: JSON.stringify({
          userId: target.userId,
          data: { name: "Committed" },
        }),
      });
      expect(response.status).toBe(200);
      expect(
        await db.query.userTable.findFirst({
          where: eq(schema.userTable.id, target.userId),
        }),
      ).toMatchObject({ name: "Committed" });
      const audit = await readAuditLog();
      expect(audit.filter((row) => row.action === "user.updated")).toEqual([
        expect.objectContaining({ targetId: target.userId }),
      ]);
      expect(log).toHaveBeenCalledWith(
        "Admin audit webhook delivery could not be queued",
      );
      const failed = await admin.api(`/users/${target.userId}`, {
        method: "PATCH",
        body: { name: "Rolled back" },
      });
      expect(failed.status).toBe(500);
      expect(
        await db.query.userTable.findFirst({
          where: eq(schema.userTable.id, target.userId),
        }),
      ).toMatchObject({ name: "Committed" });
      expect(await readAuditLog()).toEqual(audit);
      expect(await db.select().from(table)).toEqual([]);
    } finally {
      await db.execute(
        sql`ALTER TABLE instance_webhook_delivery DROP CONSTRAINT test_reject_queue`,
      );
    }
  });

  it("refuses redirect responses without retrying", async () => {
    await create();
    await record();
    status = 307;
    expect(await sendWebhookDelivery()).toBe(true);
    expect(await db.select().from(table)).toEqual([
      expect.objectContaining({
        state: "failed",
        statusCode: 307,
        errorCode: "http",
        attempts: 1,
      }),
    ]);
    await due();
    expect(await sendWebhookDelivery()).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it("signs the exact sanitized payload, routes categories, and omits payloads from history", async () => {
    const { webhook, secret } = await create();
    await create(["email"]);
    await create(["user"], false);
    await record();
    expect(await sendWebhookDelivery()).toBe(true);
    expect(await sendWebhookDelivery()).toBe(false);
    expect(requests).toHaveLength(1);
    const received = requests[0]!;
    expect(received.headers["x-kaneo-signature"]).toBe(
      `sha256=${createHmac("sha256", secret).update(`${received.headers["x-kaneo-timestamp"]}.${received.body}`).digest("hex")}`,
    );
    expect(JSON.parse(received.body)).toMatchObject({
      action: "user.updated",
      actorUserId: admin.userId,
      actorName: "admin",
      actorEmail: admin.email,
      targetId: "target",
      ipAddress: "203.0.113.2",
      metadata: { name: "Changed" },
    });
    expect(received.body).not.toContain("must-not-stream");
    expect(received.body).not.toContain("userAgent");
    expect(received.body).not.toContain(secret);
    const history = await admin.api(`/webhooks/${webhook.id}/deliveries`);
    expect(history.status).toBe(200);
    const entries = await history.json();
    expect(entries).toEqual([
      expect.objectContaining({
        action: "user.updated",
        state: "succeeded",
        attempts: 1,
        statusCode: 204,
        errorCode: null,
      }),
    ]);
    expect(JSON.stringify(entries)).not.toContain("payload");
    expect(JSON.stringify(entries)).not.toContain(admin.email);
  });

  it("retries temporary DNS lookup failures without sending or exposing their details", async () => {
    const { webhook } = await create();
    await db
      .update(schema.instanceWebhookTable)
      .set({ url: "https://receiver.example.test/events" })
      .where(eq(schema.instanceWebhookTable.id, webhook.id));
    await record();
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
    vi.mocked(lookup).mockRejectedValueOnce(
      Object.assign(new Error("private lookup details"), { code: "EAI_AGAIN" }),
    );
    expect(await sendWebhookDelivery()).toBe(true);
    expect(requests).toHaveLength(0);
    expect(await db.select().from(table)).toEqual([
      expect.objectContaining({
        state: "pending",
        errorCode: "network",
        attempts: 1,
      }),
    ]);
    expect(await sendWebhookDelivery()).toBe(false);
    await db
      .update(schema.instanceWebhookTable)
      .set({ url })
      .where(eq(schema.instanceWebhookTable.id, webhook.id));
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    await due();
    expect(await sendWebhookDelivery()).toBe(true);
    expect(requests).toHaveLength(1);
    expect(await db.select().from(table)).toEqual([
      expect.objectContaining({ state: "succeeded", attempts: 2 }),
    ]);
  });

  it("checks saved destinations again before delivery", async () => {
    await create();
    await record();
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
    expect(await sendWebhookDelivery()).toBe(true);
    expect(requests).toHaveLength(0);
    expect(await db.select().from(table)).toEqual([
      expect.objectContaining({
        state: "failed",
        errorCode: "destination",
        attempts: 1,
      }),
    ]);
    expect(await sendWebhookDelivery()).toBe(false);
  });

  it("uses the database clock for leases and backoff when an API clock is behind", async () => {
    await create();
    await record();
    const realNow = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(realNow - 3_600_000);
    expect(await claimWebhookDelivery()).not.toBeNull();
    const [leased] = await db.select().from(table);
    expect(leased!.nextAttemptAt.getTime()).toBeGreaterThan(realNow + 55_000);
    expect(await claimWebhookDelivery()).toBeNull();
    await due();
    status = 503;
    expect(await sendWebhookDelivery()).toBe(true);
    const [retry] = await db.select().from(table);
    expect(retry!.nextAttemptAt.getTime()).toBeGreaterThan(realNow + 25_000);
    expect(await sendWebhookDelivery()).toBe(false);
  });

  it("enqueues after commit and discards rolled-back audit entries", async () => {
    await create();
    await db.transaction(async (tx) => {
      await record("user.updated", tx);
      expect(await sendWebhookDelivery()).toBe(false);
      expect(requests).toHaveLength(0);
    });
    expect(await sendWebhookDelivery()).toBe(true);
    await expect(
      db.transaction(async (tx) => {
        await record("user.deleted", tx);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await sendWebhookDelivery()).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it("delivers better-auth audit hooks and test events even when the category is unselected", async () => {
    const { webhook } = await create();
    const target = await signInWithRole(app, "user");
    const response = await app.request("/api/auth/admin/update-user", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        cookie: admin.cookies,
      },
      body: JSON.stringify({
        userId: target.userId,
        data: { name: "Renamed" },
      }),
    });
    expect(response.status).toBe(200);
    expect(await sendWebhookDelivery()).toBe(true);
    expect(JSON.parse(requests[0]!.body).action).toBe("user.updated");
    expect(
      (await admin.api(`/webhooks/${webhook.id}/test`, { method: "POST" }))
        .status,
    ).toBe(202);
    expect(await sendWebhookDelivery()).toBe(true);
    expect(JSON.parse(requests[1]!.body).action).toBe("webhook.test");
    expect(await sendWebhookDelivery()).toBe(false);
  });

  it("keeps actions successful when a receiver is down, retries with backoff, and stops after three attempts", async () => {
    await create(["instance"]);
    status = 503;
    const saved = await admin.api("/settings", {
      method: "PATCH",
      body: { instanceName: "Webhook outage" },
    });
    expect(saved.status).toBe(200);
    expect(requests).toHaveLength(0);
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect(await sendWebhookDelivery()).toBe(true);
      const [job] = await db.select().from(table);
      expect(job).toMatchObject({
        attempts: attempt,
        statusCode: 503,
        errorCode: "http",
        state: attempt === 3 ? "failed" : "pending",
      });
      expect(job!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
      expect(await sendWebhookDelivery()).toBe(false);
      await due();
    }
    expect(await sendWebhookDelivery()).toBe(false);
    expect(requests).toHaveLength(3);
    expect(
      new Set(requests.map((r) => r.headers["x-kaneo-delivery"])).size,
    ).toBe(1);
    expect(JSON.stringify(await db.select().from(table))).not.toContain(
      "untrusted-secret-response-body",
    );
  });

  it("claims across workers once, recovers an expired lease, and bounds interrupted attempts", async () => {
    await create();
    await record();
    const jobs = await Promise.all(
      Array.from({ length: 8 }, () => claimWebhookDelivery()),
    );
    expect(jobs.filter(Boolean)).toHaveLength(1);
    expect(await sendWebhookDelivery()).toBe(false);
    await due();
    expect(await sendWebhookDelivery()).toBe(true);
    expect(requests).toHaveLength(1);
    await record();
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(await claimWebhookDelivery()).not.toBeNull();
      await due();
    }
    expect(await claimWebhookDelivery()).toBeNull();
    const rows = await db.select().from(table);
    expect(rows).toContainEqual(
      expect.objectContaining({
        state: "failed",
        attempts: 3,
        errorCode: "interrupted",
      }),
    );
  });

  it("uses rotated secrets, cancels disabled jobs, and retains only 20 completed deliveries", async () => {
    const { webhook } = await create();
    await record();
    const rotated = (await (
      await admin.api(`/webhooks/${webhook.id}/rotate-secret`, {
        method: "POST",
      })
    ).json()) as { secret: string };
    await sendWebhookDelivery();
    expect(requests[0]!.headers["x-kaneo-signature"]).toBe(
      `sha256=${createHmac("sha256", rotated.secret).update(`${requests[0]!.headers["x-kaneo-timestamp"]}.${requests[0]!.body}`).digest("hex")}`,
    );
    for (let i = 0; i < 22; i++) {
      await record();
      await sendWebhookDelivery();
    }
    expect(await db.select().from(table)).toHaveLength(20);
    await record();
    expect(
      (
        await admin.api(`/webhooks/${webhook.id}`, {
          method: "PUT",
          body: { url, categories: ["user"], enabled: false },
        })
      ).status,
    ).toBe(200);
    expect(await sendWebhookDelivery()).toBe(false);
    expect(
      await db.select().from(table).where(eq(table.state, "pending")),
    ).toEqual([]);
  });
});
