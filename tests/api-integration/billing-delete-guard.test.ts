import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import deleteAccountData from "../../apps/api/src/user/controllers/delete-account-data";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const CLOUD_ENV = {
  KANEO_CLOUD: "true",
  CREEM_API_KEY: "creem_test_dummy",
  CREEM_WEBHOOK_SECRET: "whsec_dummy",
};
const saved: Record<string, string | undefined> = {};

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

describe("API integration: deleting paid workspaces", () => {
  beforeAll(() => {
    for (const [key, value] of Object.entries(CLOUD_ENV)) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }
  });

  afterAll(() => {
    for (const key of Object.keys(CLOUD_ENV)) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("refuses account deletion while a workspace still has an active subscription", async () => {
    const owner = await createWorkspaceMember({
      role: "owner",
      workspaceName: "Paid Space",
    });
    await setBilling(owner.workspace.id, {
      creemSubscriptionId: "sub_active",
      creemProductId: "prod_1",
      plan: "team",
      status: "active",
    });

    await expect(deleteAccountData(owner.user.id)).rejects.toThrow(
      /"Paid Space" still has an active subscription/,
    );

    const workspaces = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, owner.workspace.id));
    expect(workspaces).toHaveLength(1);
  });

  it("allows account deletion once the subscription is cancelled", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await setBilling(owner.workspace.id, {
      creemSubscriptionId: "sub_gone",
      status: "canceled",
    });

    await deleteAccountData(owner.user.id);

    const workspaces = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, owner.workspace.id));
    expect(workspaces).toHaveLength(0);
  });

  it("allows account deletion for a workspace on the free trial", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await setBilling(owner.workspace.id, {
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await deleteAccountData(owner.user.id);

    const workspaces = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, owner.workspace.id));
    expect(workspaces).toHaveLength(0);
  });

  it("refuses workspace deletion through the API while the subscription is active", async () => {
    const { app } = createApp();

    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "paid-owner@example.com",
        password: "correct horse battery staple",
        name: "Paid Owner",
      }),
    });
    expect(signUp.status).toBe(200);
    const cookie = signUp.headers
      .getSetCookie()
      .map((entry) => entry.split(";")[0])
      .join("; ");

    const created = await app.request("/api/auth/organization/create", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Paid Space", slug: "paid-space" }),
    });
    expect(created.status).toBe(200);
    const workspace = (await created.json()) as { id: string };

    await setBilling(workspace.id, {
      creemSubscriptionId: "sub_active",
      creemProductId: "prod_1",
      plan: "team",
      status: "active",
    });

    const deleted = await app.request("/api/auth/organization/delete", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ organizationId: workspace.id }),
    });

    expect(deleted.status).toBe(409);
    expect(await deleted.text()).toMatch(/active subscription/);

    const rows = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, workspace.id));
    expect(rows).toHaveLength(1);
  });
});
