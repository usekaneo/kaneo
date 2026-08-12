import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateWorkspaceBilling } from "../../apps/api/src/billing/controllers/get-workspace-billing";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const DAY = 24 * 60 * 60 * 1000;

async function addWorkspaceOwnedBy(userId: string) {
  const workspaceId = `workspace-${randomUUID()}`;
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: workspaceId,
      createdAt: new Date(),
      name: "Extra Workspace",
      slug: `workspace-${randomUUID()}`,
    })
    .returning();

  await db.insert(schema.workspaceUserTable).values({
    workspaceId: workspace.id,
    userId,
    role: "owner",
    joinedAt: new Date(),
  });

  return workspace;
}

describe("trial is granted once per owner", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("gives a first workspace a full trial", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });

    const billing = await getOrCreateWorkspaceBilling(workspace.id);

    expect(billing.trialEndsAt).not.toBeNull();
    const remaining = (billing.trialEndsAt as Date).getTime() - Date.now();
    expect(remaining).toBeGreaterThan(13 * DAY);
    expect(remaining).toBeLessThanOrEqual(14 * DAY);
  });

  it("does not extend the trial when the owner makes another workspace", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const first = await getOrCreateWorkspaceBilling(workspace.id);

    const second = await addWorkspaceOwnedBy(user.id);
    const secondBilling = await getOrCreateWorkspaceBilling(second.id);

    expect(secondBilling.trialEndsAt?.getTime()).toBe(
      first.trialEndsAt?.getTime(),
    );
  });

  it("starts a later workspace unentitled once the owner's trial has lapsed", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    await getOrCreateWorkspaceBilling(workspace.id);

    const lapsed = new Date(Date.now() - DAY);
    await db
      .update(schema.workspaceBillingTable)
      .set({ trialEndsAt: lapsed })
      .where(eq(schema.workspaceBillingTable.workspaceId, workspace.id));

    const second = await addWorkspaceOwnedBy(user.id);
    const secondBilling = await getOrCreateWorkspaceBilling(second.id);

    expect(secondBilling.trialEndsAt?.getTime()).toBe(lapsed.getTime());
    expect(secondBilling.trialEndsAt?.getTime()).toBeLessThan(Date.now());
  });

  it("keeps trials separate for different owners", async () => {
    const { workspace: aWorkspace } = await createWorkspaceMember({
      role: "owner",
    });
    await db
      .insert(schema.workspaceBillingTable)
      .values({
        workspaceId: aWorkspace.id,
        trialEndsAt: new Date(Date.now() - DAY),
      })
      .onConflictDoNothing();

    const { workspace: bWorkspace } = await createWorkspaceMember({
      role: "owner",
    });
    const bBilling = await getOrCreateWorkspaceBilling(bWorkspace.id);

    expect(bBilling.trialEndsAt?.getTime()).toBeGreaterThan(Date.now());
  });

  it("leaves an existing billing row untouched", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const pinned = new Date(Date.now() + 99 * DAY);
    await db
      .insert(schema.workspaceBillingTable)
      .values({ workspaceId: workspace.id, trialEndsAt: pinned })
      .onConflictDoNothing();

    const billing = await getOrCreateWorkspaceBilling(workspace.id);

    expect(billing.trialEndsAt?.getTime()).toBe(pinned.getTime());
  });
});
