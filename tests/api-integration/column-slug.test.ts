import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import createColumn from "../../apps/api/src/column/controllers/create-column";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function setup() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Waiting for review",
      status: columns.inReview.slug,
      columnId: columns.inReview.id,
      userId: user.id,
      number: 1,
    })
    .returning();
  if (!task) throw new Error("Failed to seed task");
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const send = (method: string, path: string, body: object) =>
    app.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return { project, columns, task, send };
}

describe("column slugs", () => {
  it("keeps the slug and task statuses when a column is renamed", async () => {
    const { columns, task, send } = await setup();

    const response = await send("PUT", `/api/column/${columns.inReview.id}`, {
      name: "Review Queue",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: "Review Queue",
      slug: "in-review",
    });
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ status: "in-review", columnId: columns.inReview.id });
  });

  it("creates a column whose name derives a slug a renamed column still holds", async () => {
    const { project, columns, task, send } = await setup();
    await send("PUT", `/api/column/${columns.inReview.id}`, {
      name: "Review Queue",
    });

    const first = await send("POST", `/api/column/${project.id}`, {
      name: "In Review",
    });
    const second = await send("POST", `/api/column/${project.id}`, {
      name: "in review",
    });

    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      name: "In Review",
      slug: "in-review-2",
      position: 4,
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      name: "in review",
      slug: "in-review-3",
      position: 5,
    });
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ status: "in-review", columnId: columns.inReview.id });
  });

  it("still rejects names reserved for virtual statuses", async () => {
    const { project, send } = await setup();

    const response = await send("POST", `/api/column/${project.id}`, {
      name: "Planned",
    });

    expect(response.status).toBe(409);
  });

  it("gives concurrent creates distinct slugs and positions", async () => {
    const { project } = await setup();

    const created = await Promise.all(
      Array.from({ length: 5 }, () =>
        createColumn({ projectId: project.id, name: "QA" }),
      ),
    );

    expect(created.map((column) => column.slug).sort()).toEqual([
      "qa",
      "qa-2",
      "qa-3",
      "qa-4",
      "qa-5",
    ]);
    expect(created.map((column) => column.position).sort()).toEqual([
      4, 5, 6, 7, 8,
    ]);
  });
});
