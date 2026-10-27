import { createHmac } from "node:crypto";
import { createServer, type Server, type IncomingHttpHeaders } from "node:http";
import { eq } from "drizzle-orm";
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
import { claimWebhookDelivery } from "../../apps/api/src/admin/webhooks/claim-webhook-delivery";
import {
  insertInstanceRole,
  signInWithRole,
  adminApi,
} from "./helpers/admin/instance-roles";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { resetTestDatabase } from "./helpers/database";

let server: Server;
let url: string;
let status: number;
let requests: { body: string; headers: IncomingHttpHeaders }[];
let admin: Awaited<ReturnType<typeof signInWithRole>>;
let app: ReturnType<typeof createApp>["app"];
const table = schema.instanceWebhookDeliveryTable;

beforeEach(async () => {
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
