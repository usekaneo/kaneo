import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  config: vi.fn(),
  verify: vi.fn(),
  getRepo: vi.fn(),
  save: vi.fn(),
  insert: vi.fn(),
}));
// The create controller enforces the repository binding quota and inserts
// the binding inside the project's advisory-lock transaction, on the
// transaction handle. The stub mirrors that: db.transaction passes the same
// handle through, and the quota's select stub answers both chain shapes
// with "no row" (workspace override) and a zero count, so the quota is
// effectively unlimited in these tests.
vi.mock("../../../apps/api/src/database", () => {
  const handle = {
    query: {
      projectTable: {
        findFirst: async () => ({ id: "project", workspaceId: "workspace-1" }),
      },
      integrationTable: { findFirst: m.config, findMany: async () => [] },
    },
    // resolveRepositoryBindingLimits chains select().from().where().limit()
    // while countActiveRepositoryBindings awaits select().from().where()
    // directly; the where() stub returns a real Promise (awaitable, resolving
    // to the count rows) with an attached limit() method (chainable), so any
    // call order and any repetition works. A then property literal is
    // avoided on purpose: unicorn/no-thenable forbids thenable-looking
    // objects.
    select: () => ({
      from: () => ({
        where: () => {
          const whereResult = Promise.resolve([{ count: 0 }]) as Promise<
            { count: number }[]
          > & { limit: () => Promise<never[]> };
          Object.assign(whereResult, { limit: async () => [] });
          return whereResult;
        },
      }),
    }),
    insert: () => ({
      values: (data: unknown) => {
        m.insert(data);
        return {
          returning: async () => [
            {
              id: "integration",
              projectId: "project",
              isActive: true,
              createdAt: new Date("2026-01-01T00:00:00Z"),
              updatedAt: new Date("2026-01-01T00:00:00Z"),
            },
          ],
        };
      },
    }),
    update: () => ({
      set: m.save.mockReturnValue({
        where: () => ({
          returning: async () => [
            { id: "integration", projectId: "project", isActive: true },
          ],
        }),
      }),
    }),
    // tx.execute runs the pg_advisory_xact_lock statement; a no-op result is
    // enough because the stub transaction never commits or rolls back.
    execute: async () => ({ rows: [] }),
  };
  handle.transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(handle);
  return { default: handle };
});
vi.mock("../../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  GiteaApiError: class extends Error {},
  verifyGiteaToken: m.verify,
  createGiteaClient: () => ({ getRepo: m.getRepo }),
}));
const { default: reconnect } =
  await import("../../../apps/api/src/gitea-integration/controllers/create-gitea-integration");
const input = {
  projectId: "project",
  baseUrl: "https://gitea.example",
  accessToken: undefined,
  repositoryOwner: "owner",
  repositoryName: "repo",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.config.mockResolvedValue({
    id: "integration",
    config: JSON.stringify({
      baseUrl: "https://gitea.example/",
      accessToken: "saved-token",
    }),
  });
});
describe("gitea reconnect credentials", () => {
  it("rejects a changed destination before sending the saved token", async () => {
    await expect(
      reconnect({ ...input, baseUrl: "https://attacker.example" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.getRepo).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });
  it("reuses credentials only for the same normalized destination", async () => {
    await reconnect(input);
    expect(m.verify).toHaveBeenCalledWith(
      "https://gitea.example",
      "saved-token",
    );
    // The credential reuse completes as a fresh binding row inside the
    // project's lock transaction (WP3/WP10).
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project", type: "gitea" }),
    );
  });
  it("allows a changed destination with an explicitly supplied token", async () => {
    await reconnect({
      ...input,
      baseUrl: "https://new-gitea.example",
      accessToken: " new-token ",
    });
    expect(m.verify).toHaveBeenCalledWith(
      "https://new-gitea.example",
      "new-token",
    );
  });
  it("rejects invalid saved configuration without contacting a provider", async () => {
    m.config.mockResolvedValue({ id: "integration", config: "{" });
    await expect(reconnect(input)).rejects.toMatchObject({ status: 400 });
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });
});
