import { eq, inArray, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const itemTypePayload = {
  key: "work-item",
  name: "  Work item  ",
  icon: "SquareCheckBig",
  description: "General work",
  position: 2,
};

async function waitForBlockedItemTypeUpdates() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await db.execute(sql`
      select count(*)::int as count
      from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and query like '%update "item_type"%'
    `);
    if (Number(result.rows[0]?.count ?? 0) >= 2) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

describe("API integration: item types", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("allows an admin to create and list active item types in display order", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    for (const itemType of [
      itemTypePayload,
      { ...itemTypePayload, key: "bug", name: "Bug", position: 1 },
      { ...itemTypePayload, key: "feature", name: "Feature", position: 1 },
    ]) {
      const response = await app.request("/api/item-type", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...itemType, workspaceId: admin.workspace.id }),
      });
      expect(response.status).toBe(200);
    }

    const response = await app.request(
      `/api/item-type/workspace/${admin.workspace.id}`,
    );

    expect(response.status).toBe(200);
    const payload =
      (await response.json()) as (typeof schema.itemTypeTable.$inferSelect)[];
    expect(payload.map(({ key, name }) => ({ key, name }))).toEqual([
      { key: "bug", name: "Bug" },
      { key: "feature", name: "Feature" },
      { key: "work-item", name: "Work item" },
    ]);
    expect(payload.every((itemType) => itemType.archivedAt === null)).toBe(
      true,
    );
  });

  it("forbids members from creating item types", async () => {
    const member = await createWorkspaceMember();
    await db.insert(schema.itemTypeTable).values({
      workspaceId: member.workspace.id,
      key: "existing",
      name: "Existing",
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/item-type", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...itemTypePayload,
        workspaceId: member.workspace.id,
      }),
    });

    expect(response.status).toBe(403);
    expect(await db.query.itemTypeTable.findMany()).toHaveLength(1);

    const listResponse = await app.request(
      `/api/item-type/workspace/${member.workspace.id}`,
    );
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject([
      { key: "existing", name: "Existing" },
    ]);
  });

  it("allows a workspace member without item type read permission to list", async () => {
    const member = await createWorkspaceMember({
      role: "custom-no-permissions",
    });
    await db.insert(schema.itemTypeTable).values({
      workspaceId: member.workspace.id,
      key: "existing",
      name: "Existing",
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/item-type/workspace/${member.workspace.id}`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject([
      { key: "existing", name: "Existing" },
    ]);
  });

  it("rejects invalid and duplicate keys", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const invalid = await app.request("/api/item-type", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...itemTypePayload,
        key: "Invalid_Key",
        workspaceId: admin.workspace.id,
      }),
    });
    expect(invalid.status).toBe(400);

    const first = await app.request("/api/item-type", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...itemTypePayload,
        workspaceId: admin.workspace.id,
      }),
    });
    expect(first.status).toBe(200);

    const duplicate = await app.request("/api/item-type", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...itemTypePayload,
        workspaceId: admin.workspace.id,
      }),
    });
    expect(duplicate.status).toBe(409);
  });

  it("updates an item type using the workspace derived from its id", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const [itemType] = await db
      .insert(schema.itemTypeTable)
      .values({
        ...itemTypePayload,
        name: "Work item",
        workspaceId: admin.workspace.id,
      })
      .returning();
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(`/api/item-type/${itemType.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: "ticket",
        name: "  Ticket  ",
        icon: "Ticket",
        description: null,
        position: 4,
        workspaceId: "untrusted-client-workspace",
      }),
    });

    expect(response.status).toBe(200);
    const payload =
      (await response.json()) as typeof schema.itemTypeTable.$inferSelect;
    expect(payload).toMatchObject({
      id: itemType.id,
      workspaceId: admin.workspace.id,
      key: "ticket",
      name: "Ticket",
      icon: "Ticket",
      description: null,
      position: 4,
    });
  });

  it("returns conflict when concurrent updates claim the same workspace key", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const itemTypes = await db
      .insert(schema.itemTypeTable)
      .values([
        { workspaceId: admin.workspace.id, key: "alpha", name: "Alpha" },
        { workspaceId: admin.workspace.id, key: "bravo", name: "Bravo" },
      ])
      .returning();
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    let releaseRows: (() => void) | undefined;
    let rowsLocked: (() => void) | undefined;
    const locked = new Promise<void>((resolve) => {
      rowsLocked = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseRows = resolve;
    });
    const lockTransaction = db.transaction(async (tx) => {
      await tx
        .select({ id: schema.itemTypeTable.id })
        .from(schema.itemTypeTable)
        .where(
          inArray(
            schema.itemTypeTable.id,
            itemTypes.map(({ id }) => id),
          ),
        )
        .for("update");
      rowsLocked?.();
      await release;
    });
    await locked;

    const responsePromise = Promise.all(
      itemTypes.map((itemType) =>
        app.request(`/api/item-type/${itemType.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: "shared-key",
            name: itemType.name,
            icon: itemType.icon,
            description: itemType.description,
            position: itemType.position,
          }),
        }),
      ),
    );
    const updatesBlocked = await waitForBlockedItemTypeUpdates();
    releaseRows?.();

    const responses = await responsePromise;
    await lockTransaction;

    expect(updatesBlocked).toBe(true);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    const persisted = await db.query.itemTypeTable.findMany({
      where: eq(schema.itemTypeTable.workspaceId, admin.workspace.id),
    });
    expect(persisted.filter(({ key }) => key === "shared-key")).toHaveLength(1);
  });

  it("archives instead of deleting and omits archived entries from the list", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const [itemType] = await db
      .insert(schema.itemTypeTable)
      .values({
        ...itemTypePayload,
        name: "Work item",
        workspaceId: admin.workspace.id,
      })
      .returning();
    const [project] = await db
      .insert(schema.projectTable)
      .values({
        workspaceId: admin.workspace.id,
        name: "History",
        icon: "Folder",
        slug: "history",
      })
      .returning();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        itemTypeWorkspaceId: admin.workspace.id,
        itemTypeId: itemType.id,
        title: "Historical task",
        status: "to-do",
      })
      .returning();
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const archiveResponse = await app.request(`/api/item-type/${itemType.id}`, {
      method: "DELETE",
    });
    expect(archiveResponse.status).toBe(200);

    const persisted = await db.query.itemTypeTable.findFirst({
      where: eq(schema.itemTypeTable.id, itemType.id),
    });
    expect(persisted?.archivedAt).toBeInstanceOf(Date);
    const historicalTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(historicalTask).toMatchObject({
      itemTypeWorkspaceId: admin.workspace.id,
      itemTypeId: itemType.id,
    });

    const listResponse = await app.request(
      `/api/item-type/workspace/${admin.workspace.id}`,
    );
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual([]);
  });
});
