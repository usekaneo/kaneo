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

describe("lease holders with DATABASE_POOL_MAX=2", () => {
  it("do not pin a pooled client while they wait on a provider", async () => {
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
      // Session locks used to pin one of the two clients here, so these
      // returned 429. Leases leave both clients free for other requests.
      expect((await remove(second.id)).status).toBe(200);
      await expect(
        withGithubImportLock(project.id, async () => "ran"),
      ).resolves.toBe("ran");
    } finally {
      gate.resolve();
    }
    expect((await admitted).status).toBe(200);
    expect(await db.query.labelTable.findMany()).toEqual([]);
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
  });
});
