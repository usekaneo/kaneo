import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { autoClockOut } from "../../apps/api/src/attendance/auto-clock";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

const MINUTE = 60_000;

function asDevice(token: string) {
  const { app } = createApp();
  return async (path: string, body: unknown = {}) => {
    const response = await app.request(`/api/agent/device${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    // biome-ignore lint/suspicious/noExplicitAny: tests assert on response JSON field by field
    const json: any = await response.json().catch(() => null);
    return { status: response.status, json };
  };
}

async function setup(autoClock = true) {
  const { user, workspace } = await createWorkspaceMember({ role: "member" });
  if (autoClock) {
    await db
      .insert(schema.companySettingsTable)
      .values({ workspaceId: workspace.id, autoClock: true });
  }
  const code = await requestAs(user)("/agent/pairing-code", {
    method: "POST",
    body: { workspaceId: workspace.id },
  });
  const { app } = createApp();
  const paired = await app.request("/api/agent/device/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: code.json.code,
      deviceName: "Work laptop",
      platform: "windows",
    }),
  });
  const { token, deviceId } = await paired.json();
  return { user, workspaceId: workspace.id, device: asDevice(token), deviceId };
}

const sessions = () =>
  db
    .select()
    .from(schema.attendanceSessionTable)
    .orderBy(schema.attendanceSessionTable.clockIn);

describe("auto clock in/out from the desktop app", () => {
  it("does nothing until the company turns it on", async () => {
    const { device } = await setup(false);
    const beat = await device("/heartbeat", { state: "active" });
    expect(beat.json.attendance).toMatchObject({
      autoClock: false,
      clockedIn: false,
    });
    expect(await sessions()).toHaveLength(0);
  });

  it("clocks in on activity and out at the last activity once idle", async () => {
    const { device, deviceId } = await setup();

    const beat = await device("/heartbeat", { state: "active" });
    expect(beat.json.attendance).toMatchObject({
      clockedIn: true,
      automatic: true,
    });
    // Idle heartbeats keep the session but don't move the last activity.
    await device("/heartbeat", { state: "idle" });
    const [open] = await sessions();
    expect(open).toMatchObject({ source: "agent", clockOut: null });

    const [before] = await db
      .select()
      .from(schema.agentDeviceTable)
      .where(eq(schema.agentDeviceTable.id, deviceId));
    const lastActive = before?.lastActiveAt as Date;

    // The app keeps reporting in while the person is away from the keyboard.
    const idleFor = async (minutes: number) => {
      const at = new Date(lastActive.getTime() + minutes * MINUTE);
      await db
        .update(schema.agentDeviceTable)
        .set({ lastSeenAt: at })
        .where(eq(schema.agentDeviceTable.id, deviceId));
      return (await autoClockOut(at)).closed;
    };
    // Still within 15 idle minutes: stays clocked in.
    expect(await idleFor(14)).toBe(0);
    // Past it: clocked out, back-dated to the last activity.
    expect(await idleFor(16)).toBe(1);
    const [closed] = await sessions();
    expect(closed?.clockOut?.getTime()).toBe(lastActive.getTime());
    expect(closed?.clockOutSource).toBe("agent");
  });

  it("continues the same session after a short drop", async () => {
    const { device } = await setup();
    await device("/heartbeat", { state: "active" });
    // Treat "now" as far enough ahead that the device looks offline.
    await autoClockOut(new Date(Date.now() + 16 * MINUTE));
    expect((await sessions())[0]?.clockOut).not.toBeNull();

    await device("/heartbeat", { state: "active" });
    const all = await sessions();
    expect(all).toHaveLength(1);
    expect(all[0]?.clockOut).toBeNull();
  });

  it("clocks out straight away when the app quits", async () => {
    const { device } = await setup();
    await device("/heartbeat", { state: "active" });
    const quit = await device("/offline");
    expect(quit.status).toBe(200);
    expect(quit.json.attendance.clockedIn).toBe(false);
  });

  it("never clocks someone back in after they clocked out themselves", async () => {
    const { user, workspaceId, device } = await setup();
    await device("/heartbeat", { state: "active" });
    const out = await requestAs(user)("/attendance/clock-out", {
      method: "POST",
      body: { workspaceId },
    });
    expect(out.status).toBe(200);

    const beat = await device("/heartbeat", { state: "active" });
    expect(beat.json.attendance.clockedIn).toBe(false);
    expect(await sessions()).toHaveLength(1);
  });

  it("leaves sessions started by hand alone", async () => {
    const { user, workspaceId, device } = await setup();
    await requestAs(user)("/attendance/clock-in", {
      method: "POST",
      body: { workspaceId },
    });
    await device("/heartbeat", { state: "active" });
    await autoClockOut(new Date(Date.now() + 60 * MINUTE));
    const [manual] = await sessions();
    expect(manual).toMatchObject({ source: "web", clockOut: null });
  });

  it("ignores an old offline queue", async () => {
    const { device } = await setup();
    const start = new Date(Date.now() - 3 * 60 * MINUTE);
    const uploaded = await device("/activity", {
      spans: [
        {
          id: "old-span-1",
          start: start.toISOString(),
          end: new Date(start.getTime() + 5 * MINUTE).toISOString(),
          state: "active",
        },
      ],
    });
    expect(uploaded.json.accepted).toBe(1);
    expect(await sessions()).toHaveLength(0);
  });
});
