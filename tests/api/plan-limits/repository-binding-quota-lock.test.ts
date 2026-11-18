import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

// withRepositoryBindingQuotaLock runs its work inside db.transaction. The
// lock test replaces the database handle with a recording stub: the
// transaction receives a fake tx whose execute() captures the SQL statement.
const m = vi.hoisted(() => {
  const execute = vi.fn(async () => ({ rows: [] }));
  const work = vi.fn();
  return { execute, work, tx: { execute } };
});

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
  },
}));

const { withRepositoryBindingQuotaLock } =
  await import("../../../apps/api/src/plan-limits/repository-binding-quota");

const PROJECT = "project-1";

/** Collect every string and number reachable from a drizzle SQL object. */
function flatten(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string" || typeof value === "number") {
    into.push(String(value));
  } else if (Array.isArray(value)) {
    for (const item of value) flatten(item, into);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) flatten(item, into);
  }
  return into;
}

describe("withRepositoryBindingQuotaLock (WP10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks the project with pg_advisory_xact_lock inside the transaction", async () => {
    await withRepositoryBindingQuotaLock(PROJECT, async () => {});

    expect(m.execute).toHaveBeenCalledTimes(1);
    const statement = flatten(m.execute.mock.calls[0]).join(" ");
    expect(statement).toContain("pg_advisory_xact_lock");
    expect(statement).toContain("repo-binding-quota");
    expect(statement).toContain(PROJECT);
  });

  it("runs the lock statement before the work callback", async () => {
    const order: string[] = [];
    m.execute.mockImplementation(async () => {
      order.push("execute");
    });
    const work = async () => {
      order.push("work");
      return "done";
    };

    const result = await withRepositoryBindingQuotaLock(PROJECT, work);

    expect(order).toEqual(["execute", "work"]);
    expect(result).toBe("done");
  });

  it("passes the transaction handle to the work callback", async () => {
    const work = vi.fn();
    await withRepositoryBindingQuotaLock(PROJECT, work);

    // The lock statement and the work share the same transaction handle.
    expect(work).toHaveBeenCalledWith(m.tx);
  });

  it("propagates a work error so the transaction rolls back", async () => {
    m.execute.mockImplementation(async () => {});
    const work = async () => {
      throw new Error("quota write failed");
    };

    await expect(withRepositoryBindingQuotaLock(PROJECT, work)).rejects.toThrow(
      "quota write failed",
    );
    expect(m.execute).toHaveBeenCalledTimes(1);
  });
});
