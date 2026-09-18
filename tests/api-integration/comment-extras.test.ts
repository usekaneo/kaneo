import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

async function setup() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const bob = await addWorkspaceMember(workspace.id, "member", "Bob");
  const viewer = await addWorkspaceMember(workspace.id, "viewer", "Vera");
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Chatty task",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      number: 1,
      position: 1,
    })
    .returning();
  if (!task) throw new Error("no task");
  return { owner, bob, viewer, taskId: task.id };
}

const comment = (
  user: Parameters<typeof requestAs>[0],
  taskId: string,
  text: string,
  replyToId?: string,
) =>
  requestAs(user)("/activity/comment", {
    method: "POST",
    body: { taskId, comment: text, replyToId },
  });

const feed = async (user: Parameters<typeof requestAs>[0], taskId: string) =>
  (await requestAs(user)(`/activity/${taskId}`)).json.filter(
    (a: { type: string }) => a.type === "comment",
  );

describe("task comments, chat style", () => {
  it("quotes the comment being replied to and tells its author", async () => {
    const { owner, bob, taskId } = await setup();
    const question = await comment(
      owner,
      taskId,
      `Can **you** check <kaneo-mention id="${bob.id}">Bob</kaneo-mention> the [docs](https://x.dev)?`,
    );
    const answer = await comment(bob, taskId, "On it", question.json.id);
    expect(answer.status).toBe(200);
    expect(answer.json.replyToId).toBe(question.json.id);

    const [latest] = await feed(bob, taskId);
    expect(latest.replyTo).toEqual({
      id: question.json.id,
      userId: owner.id,
      userName: owner.name,
      excerpt: "Can you check Bob the docs?",
    });

    const notices = await db
      .select()
      .from(schema.notificationTable)
      .where(eq(schema.notificationTable.userId, owner.id));
    expect(notices.map((n) => n.type)).toContain("task_comment");

    // Deleting the quoted comment keeps the reply, without its quote.
    await requestAs(owner)("/activity/comment", {
      method: "DELETE",
      body: { activityId: question.json.id },
    });
    const [left] = await feed(bob, taskId);
    expect(left).toMatchObject({ content: "On it", replyTo: null });
  });

  it("only quotes comments on the same task", async () => {
    const { owner, taskId } = await setup();
    const reply = await comment(owner, taskId, "hm", "not-a-comment");
    expect(reply.status).toBe(400);
  });

  it("toggles reactions, and viewers can't react", async () => {
    const { owner, bob, viewer, taskId } = await setup();
    const note = await comment(owner, taskId, "Shipped 🚀");
    const react = (user: Parameters<typeof requestAs>[0], emoji: string) =>
      requestAs(user)("/activity/comment/reactions", {
        method: "POST",
        body: { activityId: note.json.id, emoji },
      });

    expect((await react(bob, "🎉")).json.reactions).toEqual([
      { emoji: "🎉", userIds: [bob.id] },
    ]);
    await react(owner, "🎉");
    const [withBoth] = await feed(owner, taskId);
    expect(withBoth.reactions).toEqual([
      { emoji: "🎉", userIds: [bob.id, owner.id] },
    ]);
    expect((await react(bob, "🎉")).json.reactions).toEqual([
      { emoji: "🎉", userIds: [owner.id] },
    ]);

    expect((await react(bob, "<script>")).status).toBe(400);
    expect((await react(viewer, "👍")).status).toBe(403);
  });

  it("marks edits", async () => {
    const { owner, taskId } = await setup();
    const note = await comment(owner, taskId, "typo");
    expect(note.json.editedAt).toBeNull();
    const edited = await requestAs(owner)("/activity/comment", {
      method: "PUT",
      body: { activityId: note.json.id, comment: "fixed" },
    });
    expect(edited.json.editedAt).not.toBeNull();
  });
});
