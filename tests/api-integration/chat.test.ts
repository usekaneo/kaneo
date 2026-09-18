import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

async function setup() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
  const bob = await addWorkspaceMember(workspace.id, "member", "Bob");
  return { owner, alice, bob, workspaceId: workspace.id };
}

describe("chat", () => {
  it("reuses a DM and keeps it from people outside it", async () => {
    const { owner, alice, bob, workspaceId } = await setup();

    const first = await requestAs(alice)("/chat/dms", {
      method: "POST",
      body: { workspaceId, userIds: [bob.id] },
    });
    expect(first.status).toBe(200);
    const again = await requestAs(bob)("/chat/dms", {
      method: "POST",
      body: { workspaceId, userIds: [alice.id] },
    });
    expect(again.json.id).toBe(first.json.id);

    const sent = await requestAs(alice)(`/chat/${first.json.id}/messages`, {
      method: "POST",
      body: { workspaceId, body: "hi Bob" },
    });
    expect(sent.status).toBe(200);
    expect(sent.json).toMatchObject({ body: "hi Bob", userName: "Alice" });

    const read = await requestAs(bob)(
      `/chat/${first.json.id}/messages?workspaceId=${workspaceId}`,
    );
    expect(read.json.messages.map((m: { body: string }) => m.body)).toEqual([
      "hi Bob",
    ]);

    // The owner is in the workspace but not in the DM.
    const peek = await requestAs(owner)(
      `/chat/${first.json.id}/messages?workspaceId=${workspaceId}`,
    );
    expect(peek.status).toBe(404);
    const list = await requestAs(owner)(`/chat?workspaceId=${workspaceId}`);
    expect(list.json).toEqual([]);
  });

  it("counts unread messages until the conversation is read", async () => {
    const { alice, bob, workspaceId } = await setup();
    const dm = await requestAs(alice)("/chat/dms", {
      method: "POST",
      body: { workspaceId, userIds: [bob.id] },
    });
    for (const body of ["one", "two"]) {
      await requestAs(alice)(`/chat/${dm.json.id}/messages`, {
        method: "POST",
        body: { workspaceId, body },
      });
    }

    const before = await requestAs(bob)(`/chat?workspaceId=${workspaceId}`);
    expect(before.json[0]).toMatchObject({
      unreadCount: 2,
      lastMessage: { body: "two", userName: "Alice" },
    });
    const own = await requestAs(alice)(`/chat?workspaceId=${workspaceId}`);
    expect(own.json[0].unreadCount).toBe(0);

    await requestAs(bob)(`/chat/${dm.json.id}/read`, {
      method: "POST",
      body: { workspaceId },
    });
    const after = await requestAs(bob)(`/chat?workspaceId=${workspaceId}`);
    expect(after.json[0].unreadCount).toBe(0);
  });

  it("lets anyone read an open channel but only members post", async () => {
    const { alice, bob, workspaceId } = await setup();
    const channel = await requestAs(alice)("/chat/channels", {
      method: "POST",
      body: { workspaceId, name: "#general" },
    });
    expect(channel.status).toBe(200);

    const listed = await requestAs(bob)(`/chat?workspaceId=${workspaceId}`);
    expect(listed.json[0]).toMatchObject({ name: "general", joined: false });

    const early = await requestAs(bob)(`/chat/${channel.json.id}/messages`, {
      method: "POST",
      body: { workspaceId, body: "hello" },
    });
    expect(early.status).toBe(403);

    await requestAs(bob)(`/chat/${channel.json.id}/join`, {
      method: "POST",
      body: { workspaceId },
    });
    const posted = await requestAs(bob)(`/chat/${channel.json.id}/messages`, {
      method: "POST",
      body: { workspaceId, body: "hello" },
    });
    expect(posted.status).toBe(200);

    const duplicate = await requestAs(bob)("/chat/channels", {
      method: "POST",
      body: { workspaceId, name: "General" },
    });
    expect(duplicate.status).toBe(409);
  });

  it("hides private channels from people who weren't added", async () => {
    const { alice, bob, workspaceId } = await setup();
    const secret = await requestAs(alice)("/chat/channels", {
      method: "POST",
      body: { workspaceId, name: "leads", isPrivate: true },
    });

    const list = await requestAs(bob)(`/chat?workspaceId=${workspaceId}`);
    expect(list.json).toEqual([]);
    const join = await requestAs(bob)(`/chat/${secret.json.id}/join`, {
      method: "POST",
      body: { workspaceId },
    });
    expect(join.status).toBe(403);

    await requestAs(alice)(`/chat/${secret.json.id}/members`, {
      method: "POST",
      body: { workspaceId, userIds: [bob.id] },
    });
    const now = await requestAs(bob)(`/chat?workspaceId=${workspaceId}`);
    expect(now.json[0]).toMatchObject({ name: "leads", joined: true });
  });

  it("refuses people from another workspace", async () => {
    const { alice, workspaceId } = await setup();
    const { user: stranger, workspace: other } = await createWorkspaceMember({
      role: "owner",
    });

    const dm = await requestAs(alice)("/chat/dms", {
      method: "POST",
      body: { workspaceId, userIds: [stranger.id] },
    });
    expect(dm.status).toBe(400);

    const listing = await requestAs(stranger)(
      `/chat?workspaceId=${workspaceId}`,
    );
    expect(listing.status).toBe(403);

    // A conversation id from this workspace isn't reachable through another.
    const channel = await requestAs(alice)("/chat/channels", {
      method: "POST",
      body: { workspaceId, name: "general" },
    });
    const cross = await requestAs(stranger)(
      `/chat/${channel.json.id}/messages?workspaceId=${other.id}`,
    );
    expect(cross.status).toBe(404);
  });

  it("quotes replies, toggles reactions and tracks who has read", async () => {
    const { alice, bob, workspaceId } = await setup();
    const dm = await requestAs(alice)("/chat/dms", {
      method: "POST",
      body: { workspaceId, userIds: [bob.id] },
    });
    const question = await requestAs(alice)(`/chat/${dm.json.id}/messages`, {
      method: "POST",
      body: { workspaceId, body: "lunch?" },
    });

    const answer = await requestAs(bob)(`/chat/${dm.json.id}/messages`, {
      method: "POST",
      body: { workspaceId, body: "yes", replyToId: question.json.id },
    });
    expect(answer.json.replyTo).toMatchObject({
      id: question.json.id,
      body: "lunch?",
      userName: "Alice",
    });

    // A reply can't quote a message from another conversation.
    const other = await requestAs(alice)("/chat/channels", {
      method: "POST",
      body: { workspaceId, name: "random" },
    });
    const stray = await requestAs(alice)(`/chat/${other.json.id}/messages`, {
      method: "POST",
      body: { workspaceId, body: "hm", replyToId: question.json.id },
    });
    expect(stray.status).toBe(400);

    const liked = await requestAs(alice)(
      `/chat/messages/${answer.json.id}/reactions`,
      { method: "POST", body: { workspaceId, emoji: "👍" } },
    );
    expect(liked.json.reactions).toEqual([
      { emoji: "👍", userIds: [alice.id] },
    ]);
    const unliked = await requestAs(alice)(
      `/chat/messages/${answer.json.id}/reactions`,
      { method: "POST", body: { workspaceId, emoji: "👍" } },
    );
    expect(unliked.json.reactions).toEqual([]);
    const notEmoji = await requestAs(alice)(
      `/chat/messages/${answer.json.id}/reactions`,
      { method: "POST", body: { workspaceId, emoji: "<b>" } },
    );
    expect(notEmoji.status).toBe(400);

    // Bob replied after Alice's question, so he has read past it.
    const list = await requestAs(alice)(`/chat?workspaceId=${workspaceId}`);
    const bobInDm = list.json
      .find((c: { id: string }) => c.id === dm.json.id)
      .members.find((m: { id: string }) => m.id === bob.id);
    expect(new Date(bobInDm.lastReadAt).getTime()).toBeGreaterThanOrEqual(
      new Date(question.json.createdAt).getTime(),
    );

    // Deleting the quoted message leaves the reply, without its quote.
    await requestAs(alice)(
      `/chat/messages/${question.json.id}?workspaceId=${workspaceId}`,
      { method: "DELETE" },
    );
    const after = await requestAs(bob)(
      `/chat/${dm.json.id}/messages?workspaceId=${workspaceId}`,
    );
    expect(after.json.messages).toHaveLength(1);
    expect(after.json.messages[0]).toMatchObject({
      body: "yes",
      replyTo: null,
    });
  });

  it("only lets authors edit or delete their messages", async () => {
    const { alice, bob, workspaceId } = await setup();
    const dm = await requestAs(alice)("/chat/dms", {
      method: "POST",
      body: { workspaceId, userIds: [bob.id] },
    });
    const sent = await requestAs(alice)(`/chat/${dm.json.id}/messages`, {
      method: "POST",
      body: { workspaceId, body: "typo" },
    });

    const hijack = await requestAs(bob)(`/chat/messages/${sent.json.id}`, {
      method: "PATCH",
      body: { workspaceId, body: "mine now" },
    });
    expect(hijack.status).toBe(403);

    const edited = await requestAs(alice)(`/chat/messages/${sent.json.id}`, {
      method: "PATCH",
      body: { workspaceId, body: "fixed" },
    });
    expect(edited.json).toMatchObject({ body: "fixed" });
    expect(edited.json.editedAt).not.toBeNull();

    const removed = await requestAs(alice)(
      `/chat/messages/${sent.json.id}?workspaceId=${workspaceId}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);
  });

  it("streams new messages and typing to the other members over SSE", async () => {
    const { owner, alice, bob, workspaceId } = await setup();
    const dm = await requestAs(alice)("/chat/dms", {
      method: "POST",
      body: { workspaceId, userIds: [bob.id] },
    });

    const open = async (user: typeof bob) => {
      mockAuthenticatedSession(user);
      const response = await createApp().app.request(
        `/api/chat/stream?workspaceId=${workspaceId}`,
      );
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );
      const reader = response.body?.getReader();
      if (!reader) throw new Error("no body");
      let text = "";
      // Reads until `needle` shows up, or gives up after a second.
      const until = async (needle: string) => {
        const deadline = Date.now() + 1000;
        while (!text.includes(needle) && Date.now() < deadline) {
          const chunk = await Promise.race([
            reader.read(),
            new Promise<null>((r) => setTimeout(() => r(null), 200)),
          ]);
          if (chunk && !chunk.done)
            text += new TextDecoder().decode(chunk.value);
        }
        return text;
      };
      return { until, close: () => reader.cancel() };
    };

    const bobStream = await open(bob);
    const ownerStream = await open(owner);
    expect(await bobStream.until("event: ready")).toContain("event: ready");

    await requestAs(alice)(`/chat/${dm.json.id}/typing`, {
      method: "POST",
      body: { workspaceId },
    });
    await requestAs(alice)(`/chat/${dm.json.id}/messages`, {
      method: "POST",
      body: { workspaceId, body: "psst" },
    });

    const received = await bobStream.until("psst");
    expect(received).toContain("event: CHAT_TYPING");
    expect(received).toContain("event: CHAT_MESSAGE");
    // The owner isn't in the DM, so nothing about it reaches them.
    expect(await ownerStream.until("psst")).not.toContain("psst");

    await bobStream.close();
    await ownerStream.close();
  });
});
