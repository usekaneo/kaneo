import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { formatIssueBody } from "../../apps/api/src/plugins/github/utils/format";
import { handleIssueEdited } from "../../apps/api/src/plugins/github/webhooks/issue-edited";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const m = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(async () => undefined),
}));
vi.mock("../../apps/api/src/plugins/github/services/link-manager", () => ({
  findExternalLink: m.find,
  lockExternalLink: m.find,
  updateExternalLink: m.update,
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

async function setup() {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "github",
      config: JSON.stringify({
        repositoryOwner: "example",
        repositoryName: "repo",
        installationId: 10,
        repositoryId: 20,
        verifiedGithubAccountId: "123",
        verifiedByUserId: "user",
      }),
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Linked",
      description: "Original description",
      number: 1,
    })
    .returning();
  const link = {
    id: "link",
    integrationId: integration.id,
    resourceType: "issue",
    externalId: "1",
    url: "https://github.com/example/repo/issues/1",
    taskId: task.id,
    metadata: JSON.stringify({
      lastSync: {
        description: {
          source: "kaneo",
          value: task.description,
          timestamp: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    }),
  };
  await db.insert(schema.externalLinkTable).values(link);
  m.find.mockResolvedValue(link);
  return task;
}
function webhook(body: string) {
  return handleIssueEdited({
    action: "edited",
    issue: {
      number: 1,
      title: "Linked",
      body,
      html_url: "https://github.com/example/repo/issues/1",
    },
    changes: { body: { from: "Old body" } },
    installation: { id: 10 },
    repository: {
      id: 20,
      owner: { login: "example" },
      name: "repo",
      full_name: "example/repo",
    },
  });
}

describe("GitHub description round trip", () => {
  it("ignores the echoed body even after the two-second sync window", async () => {
    const task = await setup();
    await webhook(formatIssueBody(task.description, task.id));
    const stored = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(stored?.description).toBe(task.description);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("accepts a real GitHub edit without importing the generated footer", async () => {
    const task = await setup();
    await webhook(formatIssueBody("Edited on GitHub\n\nDetails", task.id));
    const stored = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(stored?.description).toBe("Edited on GitHub\n\nDetails");
    expect(m.update).toHaveBeenCalledWith(
      "link",
      expect.objectContaining({
        metadata: expect.objectContaining({
          lastSync: expect.objectContaining({
            description: expect.objectContaining({
              source: "github",
              value: stored?.description,
            }),
          }),
        }),
      }),
      expect.anything(),
    );
  });

  it("preserves a footer mentioning a different task", async () => {
    const task = await setup();
    const body = formatIssueBody("User content", "another-task");
    await webhook(body);
    const stored = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(stored?.description).toBe(body);
  });
});
