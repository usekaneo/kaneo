import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import * as branchReconciliation from "../../apps/api/src/plugins/tangled/reconcile-branch";
import { reconcileTangledRepositories } from "../../apps/api/src/scheduler/tangled-branch-reconciliation";
import { resetTestDatabase } from "./helpers/database";
import { createTangledFixture, tangledTestConfig } from "./helpers/tangled";

const upstream = vi.hoisted(() => ({
  branches: ["main", "KAN-12"],
  failedHost: "",
  omittedBranch: "",
  refError: "",
  failedRefs: [] as string[],
  onList: () => {},
  onRef: (_ref: string, _deadline: number) => {},
  head: "b".repeat(40),
}));
vi.mock("../../apps/api/src/plugins/tangled/request-json", () => {
  class TangledRefNotFoundError extends Error {
    readonly code = "ref_not_found";
  }
  return {
    TangledRefNotFoundError,
    requestTangledJson: async (url: URL, deadline = Infinity) => {
      if (url.hostname === upstream.failedHost)
        throw new Error("private-upstream-error");
      if (url.pathname.endsWith("listBranches")) {
        upstream.onList();
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
      }
      if (url.pathname.endsWith("getRepoByRepoDid"))
        return {
          uri: "at://did:plc:repository/org.tangled.repo.manifest/self",
          value: {
            $type: "org.tangled.repo.manifest",
            declaration: { owner: "did:plc:owner", name: "repo" },
          },
        };
      if (url.pathname.endsWith("getRef")) {
        const ref = url.searchParams.get("ref")!;
        upstream.onRef(ref, deadline);
        if (upstream.refError || upstream.failedRefs.includes(ref))
          throw new Error(upstream.refError || "Temporary ref failure");
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
  upstream.failedRefs = [];
  upstream.onList = () => {};
  upstream.onRef = () => {};
  upstream.head = "b".repeat(40);
});

describe("Tangled periodic reconciliation", () => {
  it("baselines an existing branch before applying automation to a later head", async () => {
    const context = await createTangledFixture();
    const target = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: target!.id,
    });
    await reconcileTangledRepositories();
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "done",
    });
    await reconcileTangledRepositories();
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "done",
    });
    upstream.head = "c".repeat(40);
    await reconcileTangledRepositories();
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "in-progress",
      columnId: target!.id,
    });
  });

  it("preserves a manual status change after a branch baseline", async () => {
    const context = await createTangledFixture();
    const target = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: target!.id,
    });
    await reconcileTangledRepositories();
    await db
      .update(schema.taskTable)
      .set({ status: "to-do", columnId: null })
      .where(eq(schema.taskTable.id, context.task.id));
    upstream.head = "c".repeat(40);
    await reconcileTangledRepositories();
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "to-do",
    });
  });

  it("establishes a new baseline after disconnecting and reconnecting", async () => {
    const context = await createTangledFixture();
    const target = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: target!.id,
    });
    await reconcileTangledRepositories();
    await db
      .update(schema.taskTable)
      .set({ status: "to-do", columnId: null })
      .where(eq(schema.taskTable.id, context.task.id));
    await db
      .delete(schema.integrationTable)
      .where(eq(schema.integrationTable.id, context.integration.id));
    await db.insert(schema.integrationTable).values({
      projectId: context.project.id,
      type: "tangled",
      isActive: true,
      config: JSON.stringify(tangledTestConfig),
    });
    await reconcileTangledRepositories();
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "to-do",
    });
    upstream.head = "c".repeat(40);
    await reconcileTangledRepositories();
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "in-progress",
    });
  });

  it("treats invalid stored head metadata as a baseline", async () => {
    const context = await createTangledFixture();
    const target = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: target!.id,
    });
    await db.insert(schema.externalLinkTable).values({
      taskId: context.task.id,
      integrationId: context.integration.id,
      resourceType: "branch",
      externalId: "KAN-12",
      title: "KAN-12",
      url: "https://tangled.example/owner/repo/tree/KAN-12",
      metadata: "not-json",
    });
    upstream.head = "c".repeat(40);
    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: false,
    });
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "done",
    });
    const [link] = await db.query.externalLinkTable.findMany();
    expect(JSON.parse(link!.metadata!)).toMatchObject({
      lastCommit: { sha: "c".repeat(40) },
    });
  });

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

  it("logs a safe category when a scheduled scan fails", async () => {
    await createTangledFixture();
    upstream.failedHost = "api.tangled.example";
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: true,
    });
    expect(logs).toHaveBeenCalledWith("Tangled processing failed", {
      stage: "reconciliation",
      category: "unexpected",
    });
    expect(JSON.stringify(logs.mock.calls)).not.toContain(
      "private-upstream-error",
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

  it("advances the scan offset after a branch operation throws", async () => {
    await createTangledFixture();
    upstream.branches = [
      ...Array.from({ length: 20 }, (_, i) => `unrelated-${i}`),
      "KAN-12",
    ];
    vi.spyOn(
      branchReconciliation,
      "reconcileTangledBranch",
    ).mockRejectedValueOnce(new Error("Temporary transaction failure"));

    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: true,
    });
    expect(
      await db.query.tangledIntegrationStateTable.findFirst(),
    ).toMatchObject({
      scanOffset: 20,
    });
    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: false,
    });
    expect(await db.query.externalLinkTable.findMany()).toMatchObject([
      { externalId: "KAN-12" },
    ]);
  });

  it("checks later stale links and listed branches when a stale ref lookup fails", async () => {
    const { task, integration } = await createTangledFixture();
    await db.insert(schema.externalLinkTable).values(
      ["failed-stale", "deleted-stale"].map((branch, index) => ({
        id: `stale-link-${index}`,
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "branch",
        externalId: branch,
        url: `https://tangled.example/owner/repo/tree/${branch}`,
      })),
    );
    upstream.failedRefs = ["refs/heads/failed-stale"];

    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: true,
    });
    expect(
      (await db.query.externalLinkTable.findMany())
        .map((link) => link.externalId)
        .sort(),
    ).toEqual(["KAN-12", "failed-stale"]);
  });

  it("rotates past a full page of recurring stale ref failures and wraps", async () => {
    const { task, integration } = await createTangledFixture();
    upstream.branches = [];
    const staleIds = Array.from(
      { length: 22 },
      (_, i) => `stale-${String(i).padStart(2, "0")}`,
    );
    await db.insert(schema.externalLinkTable).values(
      staleIds.map((id) => ({
        id,
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "branch",
        externalId: id,
        url: `https://tangled.example/owner/repo/tree/${id}`,
      })),
    );
    upstream.failedRefs = staleIds.slice(0, 20).map((id) => `refs/heads/${id}`);
    const lookups: string[] = [];
    upstream.onRef = (ref) => lookups.push(ref);

    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: true,
    });
    expect(lookups.splice(0)).toEqual(upstream.failedRefs);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(22);
    expect(
      await db.query.tangledIntegrationStateTable.findFirst(),
    ).toMatchObject({
      staleLinkCursor: "stale-19",
    });

    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: false,
    });
    expect(lookups.splice(0)).toEqual([
      "refs/heads/stale-20",
      "refs/heads/stale-21",
    ]);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(20);
    expect(
      await db.query.tangledIntegrationStateTable.findFirst(),
    ).toMatchObject({
      staleLinkCursor: null,
    });

    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: true,
    });
    expect(lookups).toEqual(upstream.failedRefs);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(20);
  });

  it("reserves time for a listed branch and advances both cursors at the deadline", async () => {
    const { task, integration } = await createTangledFixture();
    await db.insert(schema.externalLinkTable).values(
      ["slow-stale", "unvisited-stale"].map((id) => ({
        id,
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "branch",
        externalId: id,
        url: `https://tangled.example/owner/repo/tree/${id}`,
      })),
    );
    upstream.branches = ["KAN-12", "main"];
    upstream.failedRefs = ["refs/heads/slow-stale"];
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    upstream.onList = () => clock.mockReturnValue(now + 25_000);
    const lookups: [string, number][] = [];
    upstream.onRef = (ref, deadline) => {
      lookups.push([ref, deadline]);
      clock.mockReturnValue(
        ref === "refs/heads/slow-stale" ? deadline : deadline - 1,
      );
    };
    const publishEvent = events.publishEvent;
    vi.spyOn(events, "publishEvent").mockImplementation(async (...args) => {
      clock.mockReturnValue(now + 45_000);
      await publishEvent(...args);
    });
    const reconcile = vi.spyOn(branchReconciliation, "reconcileTangledBranch");

    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: true,
    });
    expect(lookups).toEqual([
      ["refs/heads/slow-stale", now + 35_000],
      ["refs/heads/KAN-12", now + 45_000],
    ]);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(
      (await db.query.externalLinkTable.findMany())
        .map((link) => link.externalId)
        .sort(),
    ).toEqual(["KAN-12", "slow-stale", "unvisited-stale"]);
    expect(
      await db.query.tangledIntegrationStateTable.findFirst(),
    ).toMatchObject({
      staleLinkCursor: "slow-stale",
      scanOffset: 1,
    });
  });

  it("does not start a ref operation if the listing used the scan budget", async () => {
    await createTangledFixture();
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    upstream.onList = () => clock.mockReturnValue(now + 45_000);
    const reconcile = vi.spyOn(branchReconciliation, "reconcileTangledBranch");

    await reconcileTangledRepositories();
    expect(reconcile).not.toHaveBeenCalled();
    expect(
      await db.query.tangledIntegrationStateTable.findFirst(),
    ).toMatchObject({
      scanOffset: 0,
    });
  });

  it("skips task numbers above PostgreSQL's integer range and accepts the maximum", async () => {
    const { task } = await createTangledFixture();
    await db
      .update(schema.taskTable)
      .set({ number: 2_147_483_647 })
      .where(eq(schema.taskTable.id, task.id));
    upstream.branches = ["KAN-2147483648"];
    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: false,
    });
    expect(
      await db.query.tangledIntegrationStateTable.findFirst(),
    ).toMatchObject({
      code: "branch_unmatched",
    });
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);

    upstream.branches = ["KAN-2147483647"];
    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: false,
    });
    expect(await db.query.externalLinkTable.findMany()).toMatchObject([
      { taskId: task.id, externalId: "KAN-2147483647" },
    ]);
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

  it("logs a safe category when a branch lookup fails", async () => {
    await createTangledFixture();
    upstream.refError = "private branch response";
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(reconcileTangledRepositories()).resolves.toEqual({
      degraded: true,
    });
    expect(logs).toHaveBeenCalledWith("Tangled processing failed", {
      stage: "branch_lookup",
      category: "unexpected",
    });
    expect(JSON.stringify(logs.mock.calls)).not.toContain(
      "private branch response",
    );
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
