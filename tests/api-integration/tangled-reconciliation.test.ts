import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import { reconcileTangledRepositories } from "../../apps/api/src/scheduler/tangled-branch-reconciliation";
import { resetTestDatabase } from "./helpers/database";
import { createTangledFixture, tangledTestConfig } from "./helpers/tangled";

const upstream = vi.hoisted(() => ({
  branches: ["main", "KAN-12"],
  failedHost: "",
  omittedBranch: "",
  refError: "",
  head: "b".repeat(40),
}));
vi.mock("../../apps/api/src/plugins/tangled/request-json", () => {
  class TangledRefNotFoundError extends Error {
    readonly code = "ref_not_found";
  }
  return {
    TangledRefNotFoundError,
    requestTangledJson: async (url: URL) => {
      if (url.hostname === upstream.failedHost)
        throw new Error("private-upstream-error");
      if (url.pathname.endsWith("listBranches"))
        return {
          branches: upstream.branches
            .filter((name) => name !== upstream.omittedBranch)
            .map((name) => ({
              name,
              oid: upstream.head,
            })),
          total: upstream.branches.filter(
            (name) => name !== upstream.omittedBranch,
          ).length,
        };
      if (url.pathname.endsWith("getRepoByRepoDid"))
        return {
          uri: "at://did:plc:repository/org.tangled.repo.manifest/self",
          value: {
            $type: "org.tangled.repo.manifest",
            declaration: { owner: "did:plc:owner", name: "repo" },
          },
        };
      if (url.pathname.endsWith("getRef")) {
        if (upstream.refError) throw new Error(upstream.refError);
        if (
          !upstream.branches.includes(
            url.searchParams.get("ref")!.slice("refs/heads/".length),
          )
        )
          throw new TangledRefNotFoundError();
        return { name: url.searchParams.get("ref"), oid: upstream.head };
      }
      throw new Error("Unexpected upstream request");
    },
  };
});

beforeEach(async () => {
  await resetTestDatabase();
  upstream.branches = ["main", "KAN-12"];
  upstream.failedHost = "";
  upstream.omittedBranch = "";
  upstream.refError = "";
  upstream.head = "b".repeat(40);
});

describe("Tangled periodic reconciliation", () => {
  it("recovers a missed webhook and refreshes heads without changing task status", async () => {
    const context = await createTangledFixture();
    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: false,
    });
    let links = await db.query.externalLinkTable.findMany();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      taskId: context.task.id,
      externalId: "KAN-12",
    });
    upstream.head = "c".repeat(40);
    await reconcileTangledRepositories();
    links = await db.query.externalLinkTable.findMany();
    expect(links).toHaveLength(1);
    expect(JSON.parse(links[0]!.metadata!)).toMatchObject({
      lastCommit: { sha: "c".repeat(40) },
    });
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "done",
    });
  });

  it("skips disabled connections", async () => {
    const context = await createTangledFixture();
    await db
      .update(schema.integrationTable)
      .set({ isActive: false })
      .where(eq(schema.integrationTable.id, context.integration.id));
    await reconcileTangledRepositories();
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(await db.query.tangledIntegrationStateTable.findMany()).toHaveLength(
      0,
    );
  });

  it("does not let one failed integration prevent another from recovering", async () => {
    const failed = await createTangledFixture();
    const healthy = await createTangledFixture();
    await db
      .update(schema.integrationTable)
      .set({
        config: JSON.stringify({
          ...tangledTestConfig,
          origin: "https://failed.tangled.example",
        }),
      })
      .where(eq(schema.integrationTable.id, failed.integration.id));
    upstream.failedHost = "failed.tangled.example";
    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: true,
    });
    expect(await db.query.externalLinkTable.findMany()).toMatchObject([
      { integrationId: healthy.integration.id },
    ]);
    const states = await db.query.tangledIntegrationStateTable.findMany();
    expect(
      states.find((state) => state.integrationId === failed.integration.id),
    ).toMatchObject({ code: "upstream_failed", outcome: "failed" });
    expect(JSON.stringify(states)).not.toContain("private-upstream-error");
  });

  it("rotates through large branch lists without starving later branches", async () => {
    await createTangledFixture();
    upstream.branches = [
      ...Array.from({ length: 20 }, (_, i) => `unrelated-${i}`),
      "KAN-12",
    ];
    await reconcileTangledRepositories();
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(
      await db.query.tangledIntegrationStateTable.findFirst(),
    ).toMatchObject({ scanOffset: 20 });
    await reconcileTangledRepositories();
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
  });

  it("removes a deleted managed branch link without removing a manual URL or changing task status", async () => {
    const context = await createTangledFixture();
    await reconcileTangledRepositories();
    const [managed] = await db.query.externalLinkTable.findMany();
    await db.insert(schema.externalLinkTable).values({
      taskId: context.task.id,
      resourceType: "url",
      externalId: managed!.url,
      url: managed!.url,
    });
    upstream.branches = ["main"];
    const updates: unknown[] = [];
    vi.spyOn(events, "publishEvent").mockImplementation(async (type, data) => {
      if (type === "task.updated")
        updates.push({
          data,
          remaining: (await db.query.externalLinkTable.findMany()).length,
        });
    });
    await reconcileTangledRepositories();
    const links = await db.query.externalLinkTable.findMany();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      taskId: context.task.id,
      integrationId: null,
      resourceType: "url",
    });
    expect(updates).toEqual([
      {
        data: { projectId: context.project.id, taskId: context.task.id },
        remaining: 1,
      },
    ]);
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "done",
    });
  });

  it("preserves a branch recreated after the listing", async () => {
    await createTangledFixture();
    await reconcileTangledRepositories();
    upstream.omittedBranch = "KAN-12";
    await reconcileTangledRepositories();
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
  });

  it("preserves a missing branch link when the ref recheck fails for another reason", async () => {
    await createTangledFixture();
    await reconcileTangledRepositories();
    upstream.branches = ["main"];
    upstream.refError = "RepoNotFound";
    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: true,
    });
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
  });

  it("does not remove managed branch links when the branch listing fails", async () => {
    const context = await createTangledFixture();
    await reconcileTangledRepositories();
    upstream.failedHost = "api.tangled.example";
    await reconcileTangledRepositories();
    expect(
      await db.query.externalLinkTable.findMany({
        where: and(
          eq(schema.externalLinkTable.integrationId, context.integration.id),
          eq(schema.externalLinkTable.resourceType, "branch"),
        ),
      }),
    ).toHaveLength(1);
  });

  it("keeps only one sanitized outcome per connection", async () => {
    await createTangledFixture();
    await reconcileTangledRepositories();
    await reconcileTangledRepositories();
    expect(await db.query.tangledIntegrationStateTable.findMany()).toHaveLength(
      1,
    );
  });
});
