import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  BOARD_DESCRIPTION_MAX_BYTES,
  DESCRIPTION_CHUNK_CHARACTERS,
  getDescriptionPage,
} from "../../apps/api/src/task/description-pages";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);
async function fixture(description: string | null, isPublic = false) {
  const member = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  if (isPublic)
    await db
      .update(schema.projectTable)
      .set({ isPublic })
      .where(eq(schema.projectTable.id, project.id));
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Task",
      description,
      status: "to-do",
      priority: "low",
      number: 1,
    })
    .returning();
  mockAuthenticatedSession(member.user);
  return { ...createApp(), member, project, task };
}

describe("large task descriptions", () => {
  it("omits large text from both boards while retaining exact boundary-sized text", async () => {
    const body = "😺".repeat(BOARD_DESCRIPTION_MAX_BYTES / 4 + 1);
    const { app, project, task } = await fixture(body, true);
    const [small] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "At boundary",
        number: 2,
        status: "to-do",
        description: "a".repeat(BOARD_DESCRIPTION_MAX_BYTES),
      })
      .returning();
    for (const prefix of ["task/tasks", "public-project"]) {
      const response = await app.request(`/api/${prefix}/${project.id}`);
      expect(response.status).toBe(200);
      const json = await response.json();
      const tasks = (json.data ?? json).columns.flatMap(
        (column: { tasks: unknown[] }) => column.tasks,
      );
      expect(
        tasks.find((entry: { id: string }) => entry.id === task.id),
      ).toMatchObject({ description: null, descriptionDeferred: true });
      expect(
        tasks.find((entry: { id: string }) => entry.id === small.id),
      ).toMatchObject({
        description: "a".repeat(BOARD_DESCRIPTION_MAX_BYTES),
        descriptionDeferred: false,
      });
    }
  });
  it("moves a summarized task without replacing its stored description and accepts an explicit clear", async () => {
    const body = "kept ".repeat(20000);
    const { app, project, task } = await fixture(body);
    const update = {
      title: task.title,
      status: "in-progress",
      priority: "low",
      position: 5,
      projectId: project.id,
    };
    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "in-progress",
      description: null,
      descriptionDeferred: true,
    });
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.description,
    ).toBe(body);
    const cleared = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...update, description: "" }),
    });
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({
      description: "",
      descriptionDeferred: false,
    });
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.description,
    ).toBe("");
  });
  it("reads full Unicode text in bounded pages without splitting or dropping characters", async () => {
    const body = "😺é\n".repeat(DESCRIPTION_CHUNK_CHARACTERS);
    const { app, project, task } = await fixture(body, true);
    for (const url of [
      `/api/task/${task.id}/description`,
      `/api/public-project/${project.id}/task/${task.id}/description`,
    ]) {
      let offset = 0;
      let version: string | undefined;
      let actual = "";
      let pages = 0;
      while (true) {
        const response = await app.request(
          `${url}?offset=${offset}${version ? `&version=${version}` : ""}`,
        );
        expect(response.status).toBe(200);
        const page = await response.json();
        expect(Array.from(page.content).length).toBeLessThanOrEqual(
          DESCRIPTION_CHUNK_CHARACTERS,
        );
        if (version) expect(page.version).toBe(version);
        version = page.version;
        actual += page.content;
        pages++;
        if (page.nextOffset === null) break;
        expect(page.nextOffset).toBeGreaterThan(offset);
        offset = page.nextOffset;
      }
      expect(actual).toBe(body);
      expect(pages).toBe(3);
    }
  });
  it("rejects a stale version rather than joining two revisions", async () => {
    const { app, task } = await fixture("a".repeat(100000));
    const first = await (
      await app.request(`/api/task/${task.id}/description`)
    ).json();
    await db
      .update(schema.taskTable)
      .set({ description: "b".repeat(100000) })
      .where(eq(schema.taskTable.id, task.id));
    expect(
      (
        await app.request(
          `/api/task/${task.id}/description?offset=${first.nextOffset}&version=${first.version}`,
        )
      ).status,
    ).toBe(409);
  });
  it("enforces workspace access, public project ownership and visibility on every chunk", async () => {
    const { app, project, task } = await fixture("secret ".repeat(20000), true);
    const other = await createWorkspaceMember();
    const { project: otherProject } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, otherProject.id));
    mockAuthenticatedSession(other.user);
    expect((await app.request(`/api/task/${task.id}/description`)).status).toBe(
      403,
    );
    expect(
      (
        await app.request(
          `/api/task/description-matches/${project.id}?query=secret`,
        )
      ).status,
    ).toBe(403);
    mockAnonymousSession();
    expect((await app.request(`/api/task/${task.id}/description`)).status).toBe(
      401,
    );
    expect(
      (
        await app.request(
          `/api/public-project/${otherProject.id}/task/${task.id}/description`,
        )
      ).status,
    ).toBe(404);
    const url = `/api/public-project/${project.id}/task/${task.id}/description`;
    const first = await (await app.request(url)).json();
    await db
      .update(schema.projectTable)
      .set({ isPublic: false })
      .where(eq(schema.projectTable.id, project.id));
    const denied = await app.request(
      `${url}?offset=${first.nextOffset}&version=${first.version}`,
    );
    expect(denied.status).toBe(409);
    expect(await denied.text()).not.toContain("secret");
  });
  it("finds literal description matches on every bounded page, only within the project", async () => {
    const { app, project, member } = await fixture("needle short");
    const { project: other } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const body = `${"x".repeat(70000)} Needle%_tail`;
    await db.insert(schema.taskTable).values(
      Array.from({ length: 203 }, (_, i) => ({
        id: `match-${String(i).padStart(3, "0")}`,
        projectId: project.id,
        number: i + 2,
        title: "Unrelated",
        status: "to-do",
        description: body,
      })),
    );
    await db.insert(schema.taskTable).values({
      projectId: other.id,
      title: "Other",
      status: "to-do",
      description: body,
    });
    let after: string | null = null;
    const ids: string[] = [];
    do {
      const response = await app.request(
        `/api/task/description-matches/${project.id}?query=${encodeURIComponent("NEEDLE%_tail")}${after ? `&after=${after}` : ""}`,
      );
      expect(response.status).toBe(200);
      const page = await response.json();
      expect(page.ids.length).toBeLessThanOrEqual(100);
      ids.push(...page.ids);
      after = page.nextCursor;
    } while (after);
    expect(ids).toEqual(
      Array.from(
        { length: 203 },
        (_, i) => `match-${String(i).padStart(3, "0")}`,
      ),
    );
    const absent = await (
      await app.request(
        `/api/task/description-matches/${project.id}?query=NEEDLE___tail`,
      )
    ).json();
    expect(absent.ids).toEqual([]);
  });
  it("defers large project descriptions and serves complete public text with version and visibility checks", async () => {
    const { app, project } = await fixture("task body", true);
    const body = "😺project".repeat(12000);
    await db
      .update(schema.projectTable)
      .set({ description: body })
      .where(eq(schema.projectTable.id, project.id));
    for (const prefix of ["task/tasks", "public-project"]) {
      const payload = await (
        await app.request(`/api/${prefix}/${project.id}`)
      ).json();
      expect(payload.data ?? payload).toMatchObject({
        description: null,
        descriptionDeferred: true,
      });
    }
    mockAnonymousSession();
    const url = `/api/public-project/${project.id}/description`;
    let offset = 0;
    let version: string | undefined;
    let text = "";
    while (true) {
      const response = await app.request(
        `${url}?offset=${offset}${version ? `&version=${version}` : ""}`,
      );
      expect(response.status).toBe(200);
      const page = await response.json();
      expect(Array.from(page.content).length).toBeLessThanOrEqual(
        DESCRIPTION_CHUNK_CHARACTERS,
      );
      version = page.version;
      text += page.content;
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    }
    expect(text).toBe(body);
    await db
      .update(schema.projectTable)
      .set({ description: "new" })
      .where(eq(schema.projectTable.id, project.id));
    expect(
      (await app.request(`${url}?version=${version}&offset=32768`)).status,
    ).toBe(409);
    await db
      .update(schema.projectTable)
      .set({ isPublic: false })
      .where(eq(schema.projectTable.id, project.id));
    expect((await app.request(url)).status).toBe(404);
  });
  it("bounds description database work and returns a retryable error after a statement timeout", async () => {
    const { task } = await fixture("body");
    const lock = await getDatabasePool().connect();
    try {
      await lock.query("BEGIN");
      await lock.query('LOCK TABLE "task" IN ACCESS EXCLUSIVE MODE');
      await expect(
        getDescriptionPage(task.id, { offset: 0 }),
      ).rejects.toMatchObject({
        status: 503,
        message: "Description request took too long; retry later",
      });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  });
  it("validates offsets, versions and search length, including the public route", async () => {
    const { app, project, task } = await fixture(null, true);
    for (const url of [
      `/api/task/${task.id}/description`,
      `/api/public-project/${project.id}/task/${task.id}/description`,
    ]) {
      expect(await (await app.request(url)).json()).toMatchObject({
        content: "",
        nextOffset: null,
      });
      for (const query of [
        "offset=-1",
        "offset=1e9",
        "offset=2147483648",
        "version=bad",
        "offset=1.2",
      ])
        expect((await app.request(`${url}?${query}`)).status).toBe(400);
    }
    for (const query of ["", "a".repeat(257)])
      expect(
        (
          await app.request(
            `/api/task/description-matches/${project.id}?query=${query}`,
          )
        ).status,
      ).toBe(400);
  });
});
