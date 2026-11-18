import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import createIntegration from "../../apps/api/src/github-integration/controllers/create-github-integration";
import deleteIntegration from "../../apps/api/src/github-integration/controllers/delete-github-integration";
import { initialImportState } from "../../apps/api/src/github-integration/import-state";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock(
  "../../apps/api/src/github-integration/controllers/verify-repository-owner",
  () => ({
    verifyRepositoryOwner: verify,
  }),
);
beforeEach(async () => {
  await resetTestDatabase();
  verify.mockReset();
});
async function setup() {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const config = {
    repositoryOwner: "owner",
    repositoryName: "repo",
    installationId: 1,
    repositoryId: 2,
    verifiedGithubAccountId: "3",
    verifiedByUserId: member.user.id,
    branchPattern: "feature/{slug}-{number}",
    commentTaskLinkOnGitHubIssue: false,
  };
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "github",
      isActive: true,
      config: JSON.stringify(config),
      // RFC 0001 WP2: a verified binding carries its numeric repository key
      // and the denormalized identity columns, exactly like a row created
      // by the create controller or the startup migration.
      repositoryKey: "github:2",
      repositoryOwner: "owner",
      repositoryName: "repo",
      repositoryId: 2,
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Existing task", number: 1 })
    .returning();
  const [link] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://github.com/owner/repo/issues/1",
    })
    .returning();
  await db
    .insert(schema.githubImportTable)
    .values({ integrationId: integration.id, state: initialImportState(2) });
  verify.mockResolvedValue({
    repositoryOwner: "owner",
    repositoryName: "repo",
    repositoryId: 2,
    installationId: 1,
    verifiedGithubAccountId: "3",
    verifiedByUserId: member.user.id,
  });
  const connect = () =>
    createIntegration({
      userId: member.user.id,
      projectId: project.id,
      repositoryOwner: "owner",
      repositoryName: "repo",
    });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  return { project, config, integration, task, link, connect, app };
}

describe("GitHub repository changes preserve link ownership", () => {
  // RFC 0001 removed the disconnect-before-switching rule: linking another
  // repository inserts a new binding instead of mutating the existing row,
  // so the create flow only refuses a repository the project already binds
  // under the same repository key. Ownership of existing links, settings and
  // import cursors must follow the binding that created them, never the
  // newly connected one.
  it("binds a second repository that reuses a name instead of rejecting", async () => {
    const { integration, config, link, connect } = await setup();
    verify.mockResolvedValue({ ...config, repositoryId: 99 });
    const created = await connect();
    expect(created.id).not.toBe(integration.id);
    const rows = await db.query.integrationTable.findMany({
      orderBy: schema.integrationTable.createdAt,
    });
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: integration.id,
          repositoryKey: "github:2",
          config: integration.config,
        }),
        expect.objectContaining({
          id: created.id,
          repositoryKey: "github:99",
        }),
      ]),
    );
    expect(await db.query.externalLinkTable.findFirst()).toMatchObject(link);
    expect(await db.query.githubImportTable.findFirst()).toMatchObject({
      integrationId: integration.id,
    });
  });
  it("preserves links, pending imports and settings when the same repository is renamed or reinstalled", async () => {
    const { config, integration, link, connect } = await setup();
    verify.mockResolvedValue({
      repositoryOwner: "new-owner",
      repositoryName: "renamed",
      repositoryId: 2,
      installationId: 88,
      verifiedGithubAccountId: "3",
      verifiedByUserId: config.verifiedByUserId,
    });
    expect(await connect()).toMatchObject({
      id: integration.id,
      repositoryName: "renamed",
      installationId: 88,
    });
    expect(
      JSON.parse((await db.query.integrationTable.findFirst())?.config ?? "{}"),
    ).toMatchObject({
      branchPattern: config.branchPattern,
      commentTaskLinkOnGitHubIssue: false,
      repositoryId: 2,
    });
    expect(await db.query.externalLinkTable.findFirst()).toMatchObject(link);
    expect(await db.query.githubImportTable.findFirst()).toBeDefined();
  });
  it("reconciles a legacy-keyed row in place on reverification, and binds a different repository as its own row", async () => {
    const { config, integration, task, connect } = await setup();
    const legacy = {
      repositoryOwner: "OWNER",
      repositoryName: "REPO",
      installationId: 1,
    };
    // Mirror a startup-migration row: identity columns missing, repository
    // key still in the legacy owner/name form and no verified id in config.
    await db
      .update(schema.integrationTable)
      .set({
        config: JSON.stringify(legacy),
        repositoryKey: "github:owner/repo",
        repositoryOwner: null,
        repositoryName: null,
        repositoryId: null,
      })
      .where(eq(schema.integrationTable.id, integration.id));
    verify.mockResolvedValue(config);
    // Relinking the same repository reconciles the legacy row in place:
    // same id, re-keyed numerically, verified config merged.
    expect(await connect()).toMatchObject({ id: integration.id });
    expect(
      await db.query.integrationTable.findFirst({
        where: eq(schema.integrationTable.id, integration.id),
      }),
    ).toMatchObject({ repositoryKey: "github:2", repositoryId: 2 });
    // Another repository is a new binding; the legacy row keeps its identity,
    // links and import cursor.
    verify.mockResolvedValue({
      ...config,
      repositoryId: 99,
      repositoryName: "another",
    });
    const second = await connect();
    expect(second.id).not.toBe(integration.id);
    expect(
      await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, task.id),
      }),
    ).toMatchObject({
      integrationId: integration.id,
      taskId: task.id,
    });
    expect(await db.query.githubImportTable.findFirst()).toMatchObject({
      integrationId: integration.id,
    });
  });
  it("heals a legacy row with an unparseable config when its repository is relinked", async () => {
    const { integration, connect } = await setup();
    await db
      .update(schema.integrationTable)
      .set({
        config: "invalid",
        repositoryKey: "github:owner/repo",
        repositoryOwner: null,
        repositoryName: null,
        repositoryId: null,
      })
      .where(eq(schema.integrationTable.id, integration.id));
    // The legacy key still identifies the row for reconcile; verification
    // replaces the broken config, so the existing links are preserved on
    // the healed row instead of being stranded on a replaced one.
    expect(await connect()).toMatchObject({ id: integration.id });
    expect(
      JSON.parse(
        (
          await db.query.integrationTable.findFirst({
            where: eq(schema.integrationTable.id, integration.id),
          })
        )?.config ?? "{}",
      ),
    ).toMatchObject({ repositoryOwner: "owner", repositoryId: 2 });
    expect(await db.query.externalLinkTable.findFirst()).toBeDefined();
  });
  it("permits switching after disconnect without reusing old links or import cursors", async () => {
    const { config, integration, task, connect } = await setup();
    await deleteIntegration(integration.id);
    verify.mockResolvedValue({
      ...config,
      repositoryId: 99,
      repositoryName: "other",
    });
    const next = await connect();
    expect(next.id).not.toBe(integration.id);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(await db.query.githubImportTable.findMany()).toHaveLength(0);
    expect(await db.query.taskTable.findFirst()).toMatchObject({ id: task.id });
  });
  it.each(["reconnect", "settings"])(
    "rejects a concurrent repository change during %s instead of overwriting the new binding",
    async (operation) => {
      const { config, integration, connect, app } = await setup();
      const nextConfig = JSON.stringify({
        ...config,
        repositoryId: 99,
        repositoryName: "new",
      });
      const changeRowConcurrently = () =>
        db
          .update(schema.integrationTable)
          .set({ config: nextConfig })
          .where(eq(schema.integrationTable.id, integration.id));

      // Since WP10 the create handler reads the reconcile row and writes
      // inside the advisory-lock transaction, so the findFirst spy cannot
      // see the lookup anymore: the mid-flight change is injected through
      // the transaction handle the controller passes around. The settings
      // route still resolves the row through db.query.findFirst before the
      // guarded write, so the plain spy covers that branch.
      // The default export forwards through a proxy, so the spy needs the
      // real drizzle instance underneath it.
      const database = getDatabase();
      const runOriginalTransaction = database.transaction.bind(database);
      const transactionSpy = vi.spyOn(database, "transaction");
      if (operation === "reconnect") {
        // The implementation runs the real transaction, but wraps its
        // reconcile lookup so the row changes on another connection
        // between the read and the guarded write; READ COMMITTED then
        // lets the guarded update see the new config and match zero rows.
        transactionSpy.mockImplementation((async (fn) => {
          return runOriginalTransaction(async (tx) => {
            const original = tx.query.integrationTable.findFirst.bind(
              tx.query.integrationTable,
            );
            tx.query.integrationTable.findFirst = async (...args) => {
              const row = await original(...args);
              if (row) await changeRowConcurrently();
              return row;
            };
            return fn(tx);
          });
        }) as typeof db.transaction);
      }

      const find = db.query.integrationTable.findFirst.bind(
        db.query.integrationTable,
      );
      const findSpy = vi.spyOn(db.query.integrationTable, "findFirst");
      if (operation === "settings") {
        findSpy.mockImplementationOnce(async (...args) => {
          const row = await find(...args);
          await changeRowConcurrently();
          return row;
        });
      }
      try {
        if (operation === "reconnect")
          await expect(connect()).rejects.toMatchObject({ status: 409 });
        else {
          const response = await app.request(
            `/api/github-integration/integration/${integration.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ commentTaskLinkOnGitHubIssue: true }),
            },
          );
          expect(response.status).toBe(409);
        }
      } finally {
        findSpy.mockRestore();
        transactionSpy?.mockRestore();
      }
      expect((await db.query.integrationTable.findFirst())?.config).toBe(
        nextConfig,
      );
    },
  );
});
