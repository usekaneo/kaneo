import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CALENDAR_DESCRIPTION_CHARACTERS,
  CALENDAR_TASK_BATCH_SIZE,
} from "../../apps/api/src/calendar-feed/service";
import db, { schema } from "../../apps/api/src/database";
import { calendarFeedTable } from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import updateLabel from "../../apps/api/src/label/controllers/update-label";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function setup(role = "owner") {
  const member = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const labels = await db
    .insert(schema.labelTable)
    .values(
      ["Release", "Maintenance"].map((name) => ({
        name,
        color: "gray",
        workspaceId: member.workspace.id,
      })),
    )
    .returning();
  const session = mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const endpoint = `/api/calendar-feed/project/${project.id}`;
  const create = (
    body: unknown = {
      labelIds: labels.map((label) => label.id),
      timeZone: "Europe/Berlin",
    },
  ) =>
    app.request(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { member, project, labels, session, app, endpoint, create };
}

type Feed = typeof calendarFeedTable.$inferSelect;
const feedPath = (feed: Feed) =>
  `/api/calendar-feed/${feed.token}/calendar.ics`;

describe("API integration: calendar feeds", () => {
  beforeEach(resetTestDatabase);

  it("creates distinct persistent subscriptions and exposes only scheduled matching project tasks without a session", async () => {
    const { member, project, labels, session, app, create, endpoint } =
      await setup();
    const { project: otherProject } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const tasks = await db
      .insert(schema.taskTable)
      .values([
        {
          title: "Both labels",
          projectId: project.id,
          number: 1,
          startDate: new Date("2026-09-22T22:00:00Z"),
          dueDate: new Date("2026-09-24T22:00:00Z"),
        },
        {
          title: "Only maintenance",
          projectId: project.id,
          number: 2,
          dueDate: new Date("2026-09-25T22:00:00Z"),
        },
        {
          title: "Start only",
          projectId: project.id,
          number: 3,
          startDate: new Date("2026-09-27T22:00:00Z"),
        },
        { title: "Unscheduled", projectId: project.id, number: 4 },
        {
          title: "No matching label",
          projectId: project.id,
          number: 5,
          dueDate: new Date(),
        },
        {
          title: "Another project",
          projectId: otherProject.id,
          number: 1,
          dueDate: new Date(),
        },
      ])
      .returning();
    await db.insert(schema.labelTable).values([
      ...tasks
        .filter((task) => task.title !== "No matching label")
        .map((task) => ({
          name:
            task.title === "Only maintenance" ? labels[1].name : labels[0].name,
          color: "gray",
          workspaceId: member.workspace.id,
          taskId: task.id,
        })),
      {
        name: labels[1].name,
        color: "gray",
        workspaceId: member.workspace.id,
        taskId: tasks[0].id,
      },
    ]);
    const created = await create();
    expect(created.status).toBe(201);
    const feed = (await created.json()) as Feed;
    expect(feed.token).toMatch(/^[a-f0-9]{64}$/);
    const second = (await (await create()).json()) as Feed;
    expect(second.token).not.toBe(feed.token);
    expect(await (await app.request(endpoint)).json()).toHaveLength(2);
    session.mockResolvedValue(null);
    const response = await app.request(feedPath(feed));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const ics = await response.text();
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    for (const title of ["Both labels", "Only maintenance", "Start only"])
      expect(ics).toContain(`SUMMARY:${title}`);
    for (const title of ["Unscheduled", "No matching label", "Another project"])
      expect(ics).not.toContain(title);
    expect(ics).toContain(
      "DTSTART;VALUE=DATE:20260923\r\nDTEND;VALUE=DATE:20260926",
    );
    await db
      .update(schema.taskTable)
      .set({ title: "Rescheduled", dueDate: new Date("2026-10-01T22:00:00Z") })
      .where(eq(schema.taskTable.id, tasks[0].id));
    const refreshed = await (await app.request(feedPath(feed))).text();
    expect(refreshed).toContain("SUMMARY:Rescheduled");
    expect(refreshed).toContain(`UID:${tasks[0].id}@kaneo`);
    expect(refreshed).toContain("DTEND;VALUE=DATE:20261003");
    await db
      .update(schema.taskTable)
      .set({ projectId: otherProject.id, number: 10 })
      .where(eq(schema.taskTable.id, tasks[0].id));
    expect(await (await app.request(feedPath(feed))).text()).not.toContain(
      "Rescheduled",
    );
  });

  it("streams every task across batches once and bounds oversized Unicode text", async () => {
    const { member, project, labels, app, create } = await setup();
    const count = CALENDAR_TASK_BATCH_SIZE * 2 + 3;
    const description =
      "🚀".repeat(CALENDAR_DESCRIPTION_CHARACTERS) + "omitted".repeat(150_000);
    const tasks = await db
      .insert(schema.taskTable)
      .values(
        Array.from({ length: count }, (_, i) => ({
          title: i === 0 ? "T".repeat(1100) : `Task ${i}`,
          description:
            i === 0 ? description : i === 1 ? "Short description" : null,
          projectId: project.id,
          number: i + 1,
          dueDate: new Date("2026-09-23T00:00:00Z"),
        })),
      )
      .returning();
    await db.insert(schema.labelTable).values(
      tasks.flatMap((task) =>
        labels.map((label) => ({
          name: label.name,
          color: "gray",
          workspaceId: member.workspace.id,
          taskId: task.id,
        })),
      ),
    );
    const feed = (await (await create()).json()) as Feed;
    const response = await app.request(feedPath(feed));
    expect(response.status).toBe(200);
    const text = await response.text();
    const unfolded = text.replaceAll("\r\n ", "");
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(count);
    for (const task of tasks)
      expect(unfolded.split(`UID:${task.id}@kaneo\r\n`)).toHaveLength(2);
    expect(unfolded).toContain(
      `DESCRIPTION:${"🚀".repeat(CALENDAR_DESCRIPTION_CHARACTERS)}…\r\n`,
    );
    expect(unfolded).toContain("DESCRIPTION:Short description\r\n");
    expect(unfolded).toContain(`SUMMARY:${"T".repeat(1024)}…\r\n`);
    expect(unfolded).not.toContain("omitted");
    expect(Buffer.byteLength(text)).toBeLessThan(100_000);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("preserves label renames and never broadens the feed when labels are deleted", async () => {
    const { member, project, labels, app, create } = await setup();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        title: "Release task",
        projectId: project.id,
        dueDate: new Date(),
      })
      .returning();
    await db.insert(schema.labelTable).values({
      name: labels[0].name,
      color: "gray",
      workspaceId: member.workspace.id,
      taskId: task.id,
    });
    const feed = (await (
      await create({ labelIds: [labels[0].id] })
    ).json()) as Feed;
    await updateLabel(labels[0].id, "Renamed", "gray");
    expect(await (await app.request(feedPath(feed))).text()).toContain(
      "SUMMARY:Release task",
    );
    await db
      .delete(schema.labelTable)
      .where(eq(schema.labelTable.id, labels[0].id));
    const result = await (await app.request(feedPath(feed))).text();
    expect(result).toContain("BEGIN:VCALENDAR");
    expect(result).not.toContain("BEGIN:VEVENT");
  });

  it.each([true, false])(
    "keeps feeds stable after a task label is removed (workspace definition: %s)",
    async (hasDefinition) => {
      const { member, project, labels, app, create } = await setup();
      const tasks = await db
        .insert(schema.taskTable)
        .values([
          {
            title: "Original assignment",
            projectId: project.id,
            number: 1,
            dueDate: new Date(),
          },
          {
            title: "Remaining assignment",
            projectId: project.id,
            number: 2,
            dueDate: new Date(),
          },
        ])
        .returning();
      const copies = await db
        .insert(schema.labelTable)
        .values(
          tasks.map((task) => ({
            name: labels[0].name,
            color: "gray",
            workspaceId: member.workspace.id,
            taskId: task.id,
          })),
        )
        .returning();
      if (!hasDefinition)
        await db
          .delete(schema.labelTable)
          .where(eq(schema.labelTable.id, labels[0].id));
      const response = await create({ labelIds: [copies[0].id, copies[1].id] });
      expect(response.status).toBe(201);
      const feed = (await response.json()) as Feed;
      const root = await db.query.labelTable.findFirst({
        where: eq(schema.labelTable.id, feed.labelIds[0]),
      });
      expect(root?.taskId).toBeNull();
      expect(root?.name).toBe(labels[0].name);
      expect(feed.labelIds).toHaveLength(1);
      if (hasDefinition) expect(root?.id).toBe(labels[0].id);
      await updateLabel(copies[0].id, "Unrelated", "gray");
      expect(await (await app.request(feedPath(feed))).text()).toContain(
        "SUMMARY:Remaining assignment",
      );
      await db
        .delete(schema.labelTable)
        .where(eq(schema.labelTable.id, copies[0].id));
      expect(await (await app.request(feedPath(feed))).text()).toContain(
        "SUMMARY:Remaining assignment",
      );
      await updateLabel(feed.labelIds[0], "Renamed workspace label", "gray");
      expect(await (await app.request(feedPath(feed))).text()).toContain(
        "SUMMARY:Remaining assignment",
      );
    },
  );

  it("requires label creation permission only when a workspace definition is missing", async () => {
    const { member, project, labels, create } =
      await setup("calendar-publisher");
    const [role] = await db
      .insert(schema.workspaceRoleTable)
      .values({
        workspaceId: member.workspace.id,
        role: "calendar-publisher",
        permission: JSON.stringify({ project: ["share"] }),
      })
      .returning();
    expect((await create({ labelIds: [labels[0].id] })).status).toBe(201);
    const [task] = await db
      .insert(schema.taskTable)
      .values({ title: "Legacy assignment", projectId: project.id })
      .returning();
    const [copy] = await db
      .insert(schema.labelTable)
      .values({
        name: "Legacy",
        color: "gray",
        workspaceId: member.workspace.id,
        taskId: task.id,
      })
      .returning();
    expect((await create({ labelIds: [copy.id] })).status).toBe(403);
    expect(
      await db
        .select()
        .from(schema.labelTable)
        .where(eq(schema.labelTable.name, "Legacy")),
    ).toHaveLength(1);
    await db
      .update(schema.workspaceRoleTable)
      .set({
        permission: JSON.stringify({ project: ["share"], label: ["create"] }),
      })
      .where(eq(schema.workspaceRoleTable.id, role.id));
    expect((await create({ labelIds: [copy.id] })).status).toBe(201);
  });

  it("revokes one link without affecting others and cascades project deletion", async () => {
    const { app, project, endpoint, create } = await setup();
    const first = (await (await create()).json()) as Feed;
    const second = (await (await create()).json()) as Feed;
    expect(
      (await app.request(`${endpoint}/${first.id}`, { method: "DELETE" }))
        .status,
    ).toBe(200);
    expect((await app.request(feedPath(first))).status).toBe(404);
    expect((await app.request(feedPath(second))).status).toBe(200);
    await db
      .delete(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect((await app.request(feedPath(second))).status).toBe(404);
    expect(await db.select().from(calendarFeedTable)).toHaveLength(0);
  });

  it.each(["member", "viewer"])(
    "denies feed creation, listing, and revocation to %s roles",
    async (role) => {
      const { app, endpoint, create } = await setup(role);
      expect((await create()).status).toBe(403);
      expect((await app.request(endpoint)).status).toBe(403);
      expect(
        (await app.request(`${endpoint}/anything`, { method: "DELETE" }))
          .status,
      ).toBe(403);
    },
  );

  it("rejects unauthenticated management requests and invalid secret links", async () => {
    mockAnonymousSession();
    const { app } = createApp();
    for (const method of ["GET", "POST", "DELETE"]) {
      const path = `/api/calendar-feed/project/missing${method === "DELETE" ? "/feed" : ""}`;
      expect((await app.request(path, { method })).status).toBe(401);
    }
    expect(
      (await app.request(`/api/calendar-feed/${"a".repeat(64)}/calendar.ics`))
        .status,
    ).toBe(404);
    expect(
      (await app.request("/api/calendar-feed/invalid/calendar.ics")).status,
    ).toBe(400);
  });

  it("rejects foreign-workspace labels, empty selections, and invalid time zones", async () => {
    const { create, labels } = await setup();
    const foreign = await createWorkspaceMember();
    const [foreignLabel] = await db
      .insert(schema.labelTable)
      .values({
        name: "Foreign",
        color: "gray",
        workspaceId: foreign.workspace.id,
      })
      .returning();
    for (const body of [
      { labelIds: [foreignLabel.id] },
      { labelIds: [] },
      { labelIds: ["missing"] },
      { labelIds: [labels[0].id], timeZone: "Not/A_Zone" },
      { labelIds: Array(101).fill(labels[0].id) },
    ])
      expect((await create(body)).status).toBe(400);
    const response = await create({ labelIds: [labels[0].id, labels[0].id] });
    expect(response.status).toBe(201);
    expect(((await response.json()) as Feed).labelIds).toEqual([labels[0].id]);
  });

  it("does not allow a project or workspace ID to authorize another project's feed", async () => {
    const { app, endpoint, create, session } = await setup();
    const feed = (await (await create()).json()) as Feed;
    const outsider = await createWorkspaceMember({ role: "owner" });
    const { project: outsiderProject } = await createProjectFixture({
      workspaceId: outsider.workspace.id,
    });
    session.mockRestore();
    mockAuthenticatedSession(outsider.user);
    expect(
      (await app.request(`${endpoint}?workspaceId=${outsider.workspace.id}`))
        .status,
    ).toBe(403);
    expect(
      (
        await app.request(
          `/api/calendar-feed/project/${outsiderProject.id}/${feed.id}`,
          { method: "DELETE" },
        )
      ).status,
    ).toBe(404);
    expect(
      (await app.request(`${endpoint}/${feed.id}`, { method: "DELETE" }))
        .status,
    ).toBe(403);
    expect((await app.request(feedPath(feed))).status).toBe(200);
  });
});
