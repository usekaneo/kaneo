import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const CLOUD_ENV = {
  KANEO_CLOUD: "true",
  CREEM_API_KEY: "creem_test_dummy",
  CREEM_WEBHOOK_SECRET: "whsec_dummy",
};
const saved: Record<string, string | undefined> = {};

function createTask(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
) {
  return app.request(`/api/task/${projectId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Billing gate task",
      description: "",
      priority: "low",
      status: "to-do",
    }),
  });
}

async function setBilling(
  workspaceId: string,
  values: Partial<typeof schema.workspaceBillingTable.$inferInsert>,
) {
  await db
    .insert(schema.workspaceBillingTable)
    .values({ workspaceId, ...values })
    .onConflictDoUpdate({
      target: schema.workspaceBillingTable.workspaceId,
      set: values,
    });
}

describe("API integration: billing enforcement", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(CLOUD_ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
  });

  afterAll(() => {
    for (const k of Object.keys(CLOUD_ENV)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("blocks task creation with 402 when the trial has expired", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await setBilling(member.workspace.id, {
      foundingFree: false,
      trialEndsAt: new Date(Date.now() - 60_000),
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await createTask(app, project.id);
    expect(response.status).toBe(402);
  });

  it("allows task creation during an active trial", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await setBilling(member.workspace.id, {
      foundingFree: false,
      trialEndsAt: new Date(Date.now() + 60_000),
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await createTask(app, project.id);
    expect(response.status).toBe(200);
  });

  it("allows task creation for founding-free workspaces", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await setBilling(member.workspace.id, {
      foundingFree: true,
      trialEndsAt: new Date(Date.now() - 60_000),
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await createTask(app, project.id);
    expect(response.status).toBe(200);
  });

  it("allows task creation with an active subscription", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await setBilling(member.workspace.id, {
      foundingFree: false,
      trialEndsAt: new Date(Date.now() - 60_000),
      status: "active",
      plan: "personal",
      creemSubscriptionId: `sub-${member.workspace.id}`,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await createTask(app, project.id);
    expect(response.status).toBe(200);
  });
});
