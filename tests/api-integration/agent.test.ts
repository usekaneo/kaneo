import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { purgeOldActivity } from "../../apps/api/src/agent/controllers";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

// Device calls carry the device token, never a login session.
function asDevice(token: string | null) {
  const { app } = createApp();
  return async (path: string, body: unknown) => {
    const response = await app.request(`/api/agent/device${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    // biome-ignore lint/suspicious/noExplicitAny: tests assert on response JSON field by field
    let json: any = text;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: response.status, json };
  };
}

async function pairedDevice(role = "member") {
  const { user, workspace } = await createWorkspaceMember({ role });
  const code = await requestAs(user)("/agent/pairing-code", {
    method: "POST",
    body: { workspaceId: workspace.id },
  });
  const paired = await asDevice(null)("/pair", {
    code: code.json.code.toLowerCase().replace("-", " "),
    deviceName: "Work laptop",
    platform: "windows",
    agentVersion: "0.1.0",
  });
  return { user, workspace, code: code.json.code, paired };
}

const span = (id: string, start: string, minutes: number, extra = {}) => ({
  id,
  start,
  end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
  state: "active" as const,
  ...extra,
});

describe("desktop agent", () => {
  it("pairs with a one-time code and never stores the token", async () => {
    const { user, paired, code } = await pairedDevice();
    expect(paired.status).toBe(200);
    expect(paired.json.token).toMatch(/^kad_/);
    expect(paired.json.userName).toBe(user.name);

    const [device] = await db.select().from(schema.agentDeviceTable);
    expect(device?.tokenHash).not.toContain(paired.json.token);

    const reused = await asDevice(null)("/pair", {
      code,
      deviceName: "Another",
      platform: "macos",
    });
    expect(reused.status).toBe(400);
  });

  it("rejects device calls without a valid token", async () => {
    expect(
      (await asDevice(null)("/heartbeat", { state: "active" })).status,
    ).toBe(401);
    expect(
      (
        await asDevice("kad_not-a-real-token")("/heartbeat", {
          state: "active",
        })
      ).status,
    ).toBe(401);
  });

  it("stores activity once, even when a batch is retried", async () => {
    const { paired, workspace, user } = await pairedDevice();
    const device = asDevice(paired.json.token);
    const start = new Date(Date.now() - 60 * 60_000).toISOString();
    const batch = {
      spans: [
        span("span-0001", start, 5, { app: "Code" }),
        span(
          "span-0002",
          new Date(Date.parse(start) + 5 * 60_000).toISOString(),
          5,
          {
            app: "Chrome",
            domain: "www.GitHub.com",
          },
        ),
        {
          ...span(
            "span-0003",
            new Date(Date.parse(start) + 10 * 60_000).toISOString(),
            3,
          ),
          state: "idle" as const,
          app: "Chrome",
        },
      ],
    };

    const first = await device("/activity", batch);
    expect(first.json).toEqual({ accepted: 3, duplicates: 0 });
    const retry = await device("/activity", batch);
    expect(retry.json).toEqual({ accepted: 0, duplicates: 3 });

    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const summary = await requestAs(user)(
      `/agent/activity/summary?workspaceId=${workspace.id}&from=${day(-1)}&to=${day(1)}`,
    );
    expect(summary.json.activeSeconds).toBe(600);
    expect(summary.json.idleSeconds).toBe(180);
    expect(summary.json.apps).toEqual([
      { name: "Chrome", seconds: 300 },
      { name: "Code", seconds: 300 },
    ]);
    expect(summary.json.domains).toEqual([
      { name: "github.com", seconds: 300 },
    ]);
  });

  it("drops domains when the company turned domain tracking off", async () => {
    const { paired, workspace } = await pairedDevice();
    await db.insert(schema.companySettingsTable).values({
      workspaceId: workspace.id,
      trackDomains: false,
    });
    await asDevice(paired.json.token)("/activity", {
      spans: [
        span("span-1001", new Date(Date.now() - 600_000).toISOString(), 5, {
          app: "Chrome",
          domain: "github.com",
        }),
      ],
    });
    const [stored] = await db.select().from(schema.activitySpanTable);
    expect(stored?.domain).toBeNull();
  });

  it("refuses page paths in place of a domain", async () => {
    const { paired } = await pairedDevice();
    const response = await asDevice(paired.json.token)("/activity", {
      spans: [
        span("span-2001", new Date(Date.now() - 600_000).toISOString(), 5, {
          domain: "github.com/private/repo",
        }),
      ],
    });
    expect(response.status).toBe(400);
  });

  it("keeps activity private to the person and people with activity:read_all", async () => {
    const { workspace, user } = await pairedDevice("owner");
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const manager = await addWorkspaceMember(workspace.id, "manager");
    const query = `workspaceId=${workspace.id}&userId=${user.id}&from=2026-01-01&to=2026-01-07`;

    expect(
      (await requestAs(colleague)(`/agent/activity/summary?${query}`)).status,
    ).toBe(403);
    expect(
      (await requestAs(manager)(`/agent/activity/summary?${query}`)).status,
    ).toBe(200);
  });

  it("stops a revoked device and audit logs the revocation", async () => {
    const { paired, workspace, user } = await pairedDevice();
    const device = asDevice(paired.json.token);
    expect((await device("/heartbeat", { state: "active" })).status).toBe(200);

    const revoked = await requestAs(user)(
      `/agent/devices/${paired.json.deviceId}?workspaceId=${workspace.id}`,
      { method: "DELETE" },
    );
    expect(revoked.status).toBe(200);
    expect((await device("/heartbeat", { state: "active" })).status).toBe(401);

    const audit = await db
      .select()
      .from(schema.auditLogTable)
      .where(eq(schema.auditLogTable.action, "device.revoked"));
    expect(audit).toHaveLength(1);
  });

  it("stops a device whose owner left the workspace", async () => {
    const { paired, user } = await pairedDevice();
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, user.id));
    expect(
      (await asDevice(paired.json.token)("/heartbeat", { state: "active" }))
        .status,
    ).toBe(401);
  });

  it("purges details and totals past their retention", async () => {
    const { paired, workspace, user } = await pairedDevice();
    const [device] = await db.select().from(schema.agentDeviceTable);
    const old = new Date(Date.now() - 100 * 86_400_000);
    await db.insert(schema.activitySpanTable).values({
      deviceId: device?.id ?? "",
      clientId: "old-span",
      workspaceId: workspace.id,
      userId: user.id,
      startedAt: old,
      endedAt: new Date(old.getTime() + 60_000),
      state: "active",
    });
    await db.insert(schema.activityDailyTable).values({
      workspaceId: workspace.id,
      userId: user.id,
      day: "2020-01-01",
      activeSeconds: 60,
    });

    const removed = await purgeOldActivity();
    expect(removed).toEqual({ spans: 1, daily: 1 });
    expect(paired.status).toBe(200);
  });
});
