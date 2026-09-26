import { and, count, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db from "../../apps/api/src/database";
import { mcpOauthStateTable } from "../../apps/api/src/database/schema";
import {
  consumeState,
  deleteExpiredStates,
  EXPIRED_STATE_BATCH,
  getState,
  OAUTH_STATE_LIMITS,
  putState,
} from "../../apps/api/src/mcp/oauth-store";
import { resetTestDatabase } from "./helpers/database";

beforeEach(async () => {
  await resetTestDatabase();
});
const future = () => new Date(Date.now() + 60_000);
async function seed(
  kind: "client" | "request" | "code",
  total: number,
  expired = false,
  clientId = "seed-client",
) {
  await db.execute(sql`INSERT INTO mcp_oauth_state (id,kind,key,payload,expires_at)
    SELECT ${kind} || '-' || i, ${kind}, ${kind} || '-' || i,
      jsonb_build_object('clientId', ${clientId}::text),
      CASE WHEN ${expired} THEN now() - interval '1 hour' ELSE now() + interval '1 hour' END
    FROM generate_series(1, ${total}::integer) AS i`);
}
async function total(kind: string) {
  const [row] = await db
    .select({ count: count() })
    .from(mcpOauthStateTable)
    .where(eq(mcpOauthStateTable.kind, kind));
  return row.count;
}

describe("bounded shared MCP OAuth store", () => {
  it("stores by kind and consumes exactly once", async () => {
    const payload = { clientId: "client", userId: "user" };
    await putState("code", "code", payload, future());
    expect(await getState("client", "code")).toBeNull();
    expect(await getState("code", "code")).toEqual(payload);
    expect(await consumeState("code", "code")).toEqual(payload);
    expect(await consumeState("code", "code")).toBeNull();
  });

  it("bounds each cleanup batch, including registration-only traffic", async () => {
    await seed("client", EXPIRED_STATE_BATCH * 2 + 1, true);
    expect(await getState("client", "client-1")).toBeNull();
    await deleteExpiredStates();
    expect(await total("client")).toBe(EXPIRED_STATE_BATCH + 1);
    await putState("client", "fresh", {}, future());
    expect(await total("client")).toBe(2);
  });

  it("commits bounded cleanup even when a legacy over-cap table denies the insert", async () => {
    await seed(
      "client",
      OAUTH_STATE_LIMITS.client.rows + EXPIRED_STATE_BATCH * 2,
      true,
    );
    await expect(
      putState("client", "denied", {}, future()),
    ).rejects.toMatchObject({ status: 429 });
    expect(await total("client")).toBe(
      OAUTH_STATE_LIMITS.client.rows + EXPIRED_STATE_BATCH,
    );
    await expect(
      putState("client", "denied", {}, future()),
    ).rejects.toMatchObject({ status: 429 });
    expect(await total("client")).toBe(OAUTH_STATE_LIMITS.client.rows);
    await expect(
      putState("client", "accepted", {}, future()),
    ).resolves.toBeUndefined();
  });

  it.each(["client", "request", "code"] as const)(
    "enforces the real global %s cap atomically under parallel attempts without evicting live state",
    async (kind) => {
      const limit = OAUTH_STATE_LIMITS[kind].rows;
      await seed(kind, limit - 1);
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, (_, index) =>
          putState(
            kind,
            `new-${index}`,
            { clientId: `new-client-${index}` },
            future(),
          ),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      for (const result of results)
        if (result.status === "rejected")
          expect(result.reason).toMatchObject({ status: 429 });
      expect(await total(kind)).toBe(limit);
      expect(await getState(kind, `${kind}-1`)).toEqual({
        clientId: "seed-client",
      });
    },
  );

  it("limits outstanding state per client while allowing another client", async () => {
    await seed("request", OAUTH_STATE_LIMITS.request.perClient);
    await expect(
      putState("request", "denied", { clientId: "seed-client" }, future()),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      putState("request", "other", { clientId: "other-client" }, future()),
    ).resolves.toBeUndefined();
    expect(await total("request")).toBe(
      OAUTH_STATE_LIMITS.request.perClient + 1,
    );
  });

  it("enforces durable registration rate limits and reuses one counter after its window expires", async () => {
    await db.insert(mcpOauthStateTable).values({
      kind: "rate",
      key: "client",
      payload: { count: OAUTH_STATE_LIMITS.client.perMinute },
      expiresAt: future(),
    });
    await expect(
      putState("client", "denied", {}, future()),
    ).rejects.toMatchObject({ status: 429 });
    expect(await total("client")).toBe(0);
    await db
      .update(mcpOauthStateTable)
      .set({ expiresAt: new Date(0) })
      .where(eq(mcpOauthStateTable.kind, "rate"));
    await putState("client", "allowed", {}, future());
    expect(await total("rate")).toBe(1);
    expect(await total("client")).toBe(1);
  });

  it("keeps a consent request on code quota failure and atomically consumes it on success", async () => {
    await putState("request", "consent", { clientId: "client" }, future());
    await db.insert(mcpOauthStateTable).values({
      kind: "rate",
      key: "code",
      payload: { count: OAUTH_STATE_LIMITS.code.perMinute },
      expiresAt: future(),
    });
    await expect(
      putState("code", "denied", { clientId: "client" }, future(), "consent"),
    ).rejects.toMatchObject({ status: 429 });
    expect(await getState("request", "consent")).not.toBeNull();
    await db
      .delete(mcpOauthStateTable)
      .where(
        and(
          eq(mcpOauthStateTable.kind, "rate"),
          eq(mcpOauthStateTable.key, "code"),
        ),
      );
    await putState(
      "code",
      "issued",
      { clientId: "client" },
      future(),
      "consent",
    );
    expect(await getState("request", "consent")).toBeNull();
    await expect(
      putState("code", "replayed", { clientId: "client" }, future(), "consent"),
    ).rejects.toMatchObject({ status: 404 });
    expect(await total("code")).toBe(1);
  });
  it("issues only one code when multiple replicas approve the same consent", async () => {
    await putState("request", "race", { clientId: "client" }, future());
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, index) =>
        putState(
          "code",
          `code-${index}`,
          { clientId: "client" },
          future(),
          "race",
        ),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await total("code")).toBe(1);
    expect(await getState("request", "race")).toBeNull();
  });
});
