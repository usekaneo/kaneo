import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: vi.fn(async () => {}),
}));

const { resolveRepositoryBindingLimits } =
  await import("../../../apps/api/src/plan-limits/resolve-limits");
const {
  assertRepositoryBindingQuota,
  countActiveRepositoryBindings,
  getRepositoryBindingUsage,
} = await import("../../../apps/api/src/plan-limits/repository-binding-quota");
const { publishEvent } = await import("../../../apps/api/src/events");

// Minimal drizzle-shaped stubs. The helpers run, in order:
//   resolveRepositoryBindingLimits -> select().from().where().limit() (awaited)
//   countActiveRepositoryBindings  -> select().from().where()         (awaited)
function fakeDatabase({
  limitRow,
  countRow,
}: {
  limitRow: unknown[];
  countRow: { count: number };
}) {
  let stage: "limit" | "count" = "limit";
  return {
    select: () =>
      stage === "limit"
        ? {
            from: () => ({
              where: () => ({
                limit: async () => {
                  stage = "count";
                  return limitRow;
                },
              }),
            }),
          }
        : { from: () => ({ where: async () => [countRow] }) },
  } as never;
}

const WORKSPACE = "workspace-1";
const PROJECT = "project-1";

describe("resolveRepositoryBindingLimits (WP10)", () => {
  afterEach(() => {
    delete process.env.KANEO_MAX_REPOSITORIES_PER_PROJECT;
    vi.clearAllMocks();
  });

  it("returns the workspace override when the row exists", async () => {
    const database = fakeDatabase({
      limitRow: [{ maxRepositoriesPerProject: 2 }],
      countRow: { count: 0 },
    });
    process.env.KANEO_MAX_REPOSITORIES_PER_PROJECT = "10";

    expect(await resolveRepositoryBindingLimits(WORKSPACE, database)).toEqual({
      maxPerProject: 2,
    });
  });

  it("falls back to the instance env default when no row exists", async () => {
    const database = fakeDatabase({ limitRow: [], countRow: { count: 0 } });
    process.env.KANEO_MAX_REPOSITORIES_PER_PROJECT = "5";

    expect(await resolveRepositoryBindingLimits(WORKSPACE, database)).toEqual({
      maxPerProject: 5,
    });
  });

  it("is unlimited when no row exists and the env is unset", async () => {
    const database = fakeDatabase({ limitRow: [], countRow: { count: 0 } });

    expect(await resolveRepositoryBindingLimits(WORKSPACE, database)).toEqual({
      maxPerProject: null,
    });
  });

  it("treats a non-positive env value as unlimited", async () => {
    const database = fakeDatabase({ limitRow: [], countRow: { count: 0 } });
    process.env.KANEO_MAX_REPOSITORIES_PER_PROJECT = "0";

    expect(await resolveRepositoryBindingLimits(WORKSPACE, database)).toEqual({
      maxPerProject: null,
    });
  });
});

describe("repository binding quota (WP10)", () => {
  afterEach(() => {
    delete process.env.KANEO_MAX_REPOSITORIES_PER_PROJECT;
    vi.clearAllMocks();
  });

  it("counts active repository bindings via the injected database", async () => {
    const database = fakeDatabase({ limitRow: [], countRow: { count: 3 } });

    expect(await countActiveRepositoryBindings(PROJECT, database)).toBe(3);
  });

  it("throws 402 with used and limit when the project is at the limit", async () => {
    const database = fakeDatabase({
      limitRow: [{ maxRepositoriesPerProject: 2 }],
      countRow: { count: 2 },
    });

    await expect(
      assertRepositoryBindingQuota(PROJECT, WORKSPACE, database),
    ).rejects.toMatchObject({
      status: 402,
      used: 2,
      limit: 2,
    });
    expect(publishEvent).toHaveBeenCalledTimes(1);
    expect(publishEvent).toHaveBeenCalledWith(
      "integration.binding_quota_exceeded",
      {
        workspaceId: WORKSPACE,
        projectId: PROJECT,
        used: 2,
        limit: 2,
      },
    );
  });

  it("passes when the project is below the limit", async () => {
    const database = fakeDatabase({
      limitRow: [{ maxRepositoriesPerProject: 5 }],
      countRow: { count: 2 },
    });

    await expect(
      assertRepositoryBindingQuota(PROJECT, WORKSPACE, database),
    ).resolves.toBeUndefined();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("never enforces when the limit is unlimited", async () => {
    const database = fakeDatabase({ limitRow: [], countRow: { count: 99 } });

    await expect(
      assertRepositoryBindingQuota(PROJECT, WORKSPACE, database),
    ).resolves.toBeUndefined();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("exposes a usage summary that matches the enforcement count", async () => {
    const database = fakeDatabase({
      limitRow: [{ maxRepositoriesPerProject: 5 }],
      countRow: { count: 3 },
    });

    expect(
      await getRepositoryBindingUsage(PROJECT, WORKSPACE, database),
    ).toEqual({ used: 3, limit: 5 });
  });
});
