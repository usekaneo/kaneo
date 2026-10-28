import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { probeDatabase } from "./probe-database";

const { execute } = vi.hoisted(() => ({
  execute:
    vi.fn<(query: SQL) => Promise<{ rows: Record<string, unknown>[] }>>(),
}));

vi.mock("../../database", () => ({
  default: {
    execute,
    transaction: (work: (tx: { execute: typeof execute }) => unknown) =>
      work({ execute }),
  },
}));

describe("probeDatabase", () => {
  afterEach(() => vi.useRealTimers());

  it("shares one deadline between the version and migration queries", async () => {
    vi.useFakeTimers();
    execute.mockImplementation(async (query) => {
      const text = new PgDialect().sqlToQuery(query).sql;
      if (text.includes("server_version")) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return { rows: [{ version: "17" }] };
      }
      if (text.includes("count(*)")) return new Promise(() => {});
      return { rows: [] };
    });
    let result: Awaited<ReturnType<typeof probeDatabase>> | undefined;
    const pending = probeDatabase(100).then((value) => {
      result = value;
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(result).toMatchObject({ status: "down", errorCode: "TIMEOUT" });
    await pending;
  });
});
