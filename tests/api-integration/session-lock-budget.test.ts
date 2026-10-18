import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { withGithubImportLock } from "../../apps/api/src/github-integration/import-lock";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const github = vi.hoisted(() =>
  vi.fn(async (_id: string, _name: string) => {}),
);
vi.mock("../../apps/api/src/plugins/github/utils/sync-label-to-github", () => ({
  removeLabelFromGitHub: github,
  syncLabelToGitHub: vi.fn(),
}));
// Set this before the lazy database pool opens any connections.
vi.stubEnv("DATABASE_POOL_MAX", "2");
afterAll(() => vi.unstubAllEnvs());

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  await resetTestDatabase();
  github.mockReset().mockResolvedValue();
});

describe("session locks with DATABASE_POOL_MAX=2", () => {
  it("returns 429 to a lock holder beyond pool size - 1 instead of timing out its queries", async () => {
    expect(getDatabasePool().options.max).toBe(2);
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Task",
        status: "to-do",
        number: 1,
      })
      .returning();
    const [first, second] = await db
      .insert(schema.labelTable)
      .values(
        ["bug", "docs"].map((name) => ({
          workspaceId: member.workspace.id,
          taskId: task.id,
          name,
          color: "red",
        })),
      )
      .returning();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const remove = (id: string) =>
      app.request(`/api/label/${id}`, { method: "DELETE" });

    const gate = deferred();
    github.mockImplementationOnce(() => gate.promise);
    const admitted = remove(first.id);
    try {
      await vi.waitFor(() => expect(github).toHaveBeenCalledTimes(1));
      const busy = await remove(second.id);
      expect(busy.status).toBe(429);
      expect(busy.headers.get("Retry-After")).toBe("1");
      await expect(
        withGithubImportLock(project.id, async () => "must not run"),
      ).rejects.toMatchObject({ status: 429 });
    } finally {
      gate.resolve();
    }
    expect((await admitted).status).toBe(200);

    expect((await remove(second.id)).status).toBe(200);
    expect(
      await withGithubImportLock(project.id, () =>
        db.query.labelTable.findMany(),
      ),
    ).toEqual([]);
  });
});
