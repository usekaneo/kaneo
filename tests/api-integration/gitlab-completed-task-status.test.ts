import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { handleGitlabMergeRequestOpened } from "../../apps/api/src/plugins/gitlab/webhooks/merge-request-opened";
import { handleGitlabPush } from "../../apps/api/src/plugins/gitlab/webhooks/push";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function createFixture() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug: "KAN",
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "gitlab",
      isActive: true,
      config: JSON.stringify({
        baseUrl: "https://gitlab.example",
        projectPath: "group/project",
        accessToken: "fake-test-token",
        branchPattern: "{slug}-{number}",
      }),
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      number: 42,
      title: "Task 42",
      status: "done",
      columnId: columns.done.id,
      priority: "medium",
      position: 0,
    })
    .returning();
  return { project, columns, integration, task };
}

describe("GitLab merge requests on a completed task", () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;

  const mergeRequest = (
    overrides: { draft?: boolean; branch?: string; description?: string } = {},
  ) => ({
    object_attributes: {
      iid: 7,
      title: "Slice 2",
      description: overrides.description ?? null,
      url: "https://gitlab.example/group/project/-/merge_requests/7",
      state: "opened",
      draft: overrides.draft ?? false,
      source_branch: overrides.branch ?? "kan-42-slice-2",
    },
    project: {
      name: "project",
      web_url: "https://gitlab.example/group/project",
      path_with_namespace: "group/project",
    },
  });
  const status = async () =>
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, fixture.task.id),
      })
    )?.status;
  const complete = () =>
    db
      .update(schema.taskTable)
      .set({ status: "done", columnId: fixture.columns.done.id })
      .where(eq(schema.taskTable.id, fixture.task.id));

  beforeEach(async () => {
    await resetTestDatabase();
    fixture = await createFixture();
  });

  it("moves the task to review when a draft becomes ready", async () => {
    await handleGitlabMergeRequestOpened(
      mergeRequest({ draft: true }),
      fixture.integration.id,
      { moveTask: false },
    );
    expect(await status()).toBe("done");

    await handleGitlabMergeRequestOpened(
      mergeRequest(),
      fixture.integration.id,
    );
    expect(await status()).toBe("in-review");
  });

  it("keeps the task done for a repeated ready delivery", async () => {
    await handleGitlabMergeRequestOpened(
      mergeRequest(),
      fixture.integration.id,
    );
    await complete();
    await handleGitlabMergeRequestOpened(
      mergeRequest(),
      fixture.integration.id,
    );
    expect(await status()).toBe("done");
  });

  it("links a merge request through the task link", async () => {
    const taskLink = `https://kaneo.example.com/dashboard/workspace/w/project/${fixture.project.id}/task/${fixture.task.id}`;
    await handleGitlabMergeRequestOpened(
      mergeRequest({ branch: "unrelated", description: taskLink }),
      fixture.integration.id,
    );
    expect(await status()).toBe("in-review");
  });

  it("does not move a task that moved to another project", async () => {
    await handleGitlabMergeRequestOpened(
      mergeRequest({ draft: true }),
      fixture.integration.id,
      { moveTask: false },
    );
    const other = await createProjectFixture({
      workspaceId: fixture.project.workspaceId,
      slug: "OTHER",
    });
    await db
      .update(schema.taskTable)
      .set({ projectId: other.project.id, columnId: other.columns.done.id })
      .where(eq(schema.taskTable.id, fixture.task.id));

    await handleGitlabMergeRequestOpened(
      mergeRequest(),
      fixture.integration.id,
    );
    expect(await status()).toBe("done");
  });
});

describe("GitLab pushes to a completed task", () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;

  const push = (after?: string) =>
    handleGitlabPush(
      {
        after,
        ref: "refs/heads/kan-42-slice-2",
        project: {
          name: "project",
          web_url: "https://gitlab.example/group/project",
          path_with_namespace: "group/project",
        },
      },
      fixture.integration.id,
    );
  const status = async () =>
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, fixture.task.id),
      })
    )?.status;
  const complete = () =>
    db
      .update(schema.taskTable)
      .set({ status: "done", columnId: fixture.columns.done.id })
      .where(eq(schema.taskTable.id, fixture.task.id));

  beforeEach(async () => {
    await resetTestDatabase();
    fixture = await createFixture();
  });

  it("moves the task back to progress for a new branch", async () => {
    await push();
    expect(await status()).toBe("in-progress");
  });

  it("keeps the task done for a push to an already linked branch", async () => {
    await push();
    await complete();
    await push();
    expect(await status()).toBe("done");
  });

  it("ignores a push that deletes the branch", async () => {
    await push("0".repeat(40));
    expect(await status()).toBe("done");
  });
});
