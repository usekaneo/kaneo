import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type User = Parameters<typeof mockAuthenticatedSession>[0];

async function call(user: User, method: string, path: string, body?: unknown) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const response = await app.request(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

async function createLead(projectId: string) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: "Follow up",
      description: "",
      number: 1,
      status: "to-do",
    })
    .returning();
  return task;
}

beforeEach(resetTestDatabase);

describe("contacts", () => {
  it("lets members manage contacts, filter them, and read-only viewers only list", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const viewer = await addWorkspaceMember(workspace.id, "viewer");
    const base = `/contact/workspace/${workspace.id}`;

    const ali = await call(owner, "POST", base, {
      name: "Ali Stores",
      phone: "7771234",
      type: "retailer",
      region: "male",
    });
    expect(ali.status).toBe(201);
    await call(owner, "POST", base, { name: "Blue Wave", type: "distributor" });

    const all = await call(viewer, "GET", base);
    expect(all.body.map((c: { name: string }) => c.name)).toEqual([
      "Ali Stores",
      "Blue Wave",
    ]);
    const filtered = await call(owner, "GET", `${base}?region=male&search=777`);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0]).toMatchObject({
      name: "Ali Stores",
      leadCount: 0,
    });

    expect((await call(viewer, "POST", base, { name: "Nope" })).status).toBe(
      403,
    );
    expect(
      (await call(viewer, "DELETE", `${base}/${ali.body.id}`)).status,
    ).toBe(403);

    const bad = await call(owner, "POST", base, { name: "X", region: "mars" });
    expect(bad.status).toBe(400);

    const edited = await call(owner, "PATCH", `${base}/${ali.body.id}`, {
      phone: null,
    });
    expect(edited.body).toMatchObject({ name: "Ali Stores", phone: null });
  });

  it("links a lead to a contact, counts it, and unlinks it when the contact is deleted", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const task = await createLead(project.id);
    const base = `/contact/workspace/${workspace.id}`;
    const contact = await call(owner, "POST", base, { name: "Ali Stores" });

    const linked = await call(owner, "PUT", `/task/contact/${task.id}`, {
      contactId: contact.body.id,
    });
    expect(linked.status).toBe(200);
    expect(linked.body.contactId).toBe(contact.body.id);

    const fetched = await call(owner, "GET", `/task/${task.id}`);
    expect(fetched.body.contactId).toBe(contact.body.id);
    const listed = await call(owner, "GET", base);
    expect(listed.body[0].leadCount).toBe(1);

    const removed = await call(owner, "DELETE", `${base}/${contact.body.id}`);
    expect(removed.status).toBe(200);
    const [after] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(after.contactId).toBeNull();
  });

  it("rejects a contact from another workspace and hides it from outsiders", async () => {
    const mine = await createWorkspaceMember({ role: "owner" });
    const theirs = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: mine.workspace.id,
    });
    const task = await createLead(project.id);
    const foreign = await call(
      theirs.user,
      "POST",
      `/contact/workspace/${theirs.workspace.id}`,
      { name: "Secret" },
    );

    const link = await call(mine.user, "PUT", `/task/contact/${task.id}`, {
      contactId: foreign.body.id,
    });
    expect(link.status).toBe(404);

    const peek = await call(
      mine.user,
      "GET",
      `/contact/workspace/${theirs.workspace.id}`,
    );
    expect([403, 404]).toContain(peek.status);

    const created = await call(mine.user, "POST", `/task/${project.id}`, {
      title: "Lead",
      description: "",
      priority: "low",
      status: "to-do",
      contactId: foreign.body.id,
    });
    expect(created.status).toBe(404);
  });

  it("merges comments on a contact's leads into a timeline and hides restricted projects", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const open = await createProjectFixture({ workspaceId: workspace.id });
    const hidden = await createProjectFixture({ workspaceId: workspace.id });
    const rep = await addWorkspaceMember(workspace.id, "member");
    await restrictToProjects(workspace.id, rep.id, [open.project.id]);

    const contact = await call(
      owner,
      "POST",
      `/contact/workspace/${workspace.id}`,
      { name: "Ali Stores" },
    );
    const visibleLead = await createLead(open.project.id);
    const [privateLead] = await db
      .insert(schema.taskTable)
      .values({
        projectId: hidden.project.id,
        title: "Private lead",
        number: 1,
        status: "to-do",
        contactId: contact.body.id,
        dueDate: new Date("2030-01-01"),
      })
      .returning();
    await db
      .update(schema.taskTable)
      .set({
        contactId: contact.body.id,
        dueDate: new Date("2030-02-01"),
      })
      .where(eq(schema.taskTable.id, visibleLead.id));

    const note = (taskId: string, content: string, at: string) =>
      db.insert(schema.activityTable).values({
        taskId,
        type: "comment",
        userId: owner.id,
        content,
        createdAt: new Date(at),
      });
    await note(visibleLead.id, "Called, wants a quote", "2030-01-02T10:00:00Z");
    await note(visibleLead.id, "Sent the quote", "2030-01-03T10:00:00Z");
    await note(privateLead.id, "Secret terms", "2030-01-04T10:00:00Z");
    await db.insert(schema.activityTable).values({
      taskId: visibleLead.id,
      type: "comment",
      userId: null,
      content: "Replied on WhatsApp",
      externalUserName: "WhatsApp bot",
      externalSource: "whatsapp",
      externalUrl: "https://example.com/msg/1",
      createdAt: new Date("2030-01-02T12:00:00Z"),
    });
    await db.insert(schema.activityTable).values({
      taskId: visibleLead.id,
      type: "title_changed",
      userId: owner.id,
      content: null,
    });

    const path = `/contact/workspace/${workspace.id}/${contact.body.id}/timeline`;
    const asOwner = await call(owner, "GET", path);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.leads.map((l: { title: string }) => l.title)).toEqual([
      "Private lead",
      "Follow up",
    ]);
    expect(
      asOwner.body.entries.map((e: { content: string }) => e.content),
    ).toEqual([
      "Secret terms",
      "Sent the quote",
      "Replied on WhatsApp",
      "Called, wants a quote",
    ]);
    const external = asOwner.body.entries.find(
      (e: { content: string }) => e.content === "Replied on WhatsApp",
    );
    expect(external.user.name).toBe("WhatsApp bot");

    const asRep = await call(rep, "GET", path);
    expect(asRep.status).toBe(200);
    expect(asRep.body.leads.map((l: { title: string }) => l.title)).toEqual([
      "Follow up",
    ]);
    expect(
      asRep.body.entries.map((e: { content: string }) => e.content),
    ).toEqual([
      "Sent the quote",
      "Replied on WhatsApp",
      "Called, wants a quote",
    ]);
    expect(JSON.stringify(asRep.body)).not.toContain("Secret");

    // The list must not reveal how many leads sit in a project the rep cannot open.
    const listPath = `/contact/workspace/${workspace.id}`;
    const ownerList = await call(owner, "GET", listPath);
    const repList = await call(rep, "GET", listPath);
    expect(ownerList.body[0].leadCount).toBe(2);
    expect(repList.body[0].leadCount).toBe(1);

    const missing = await call(
      owner,
      "GET",
      `/contact/workspace/${workspace.id}/nope/timeline`,
    );
    expect(missing.status).toBe(404);
  });

  it("rejects an empty contactId instead of failing in the database", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const task = await createLead(project.id);

    const response = await call(owner, "PUT", `/task/contact/${task.id}`, {
      contactId: "",
    });
    expect(response.status).toBe(400);
  });

  it("does not reveal which tasks are leads on a public board", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    const task = await createLead(project.id);
    const contact = await call(
      owner,
      "POST",
      `/contact/workspace/${workspace.id}`,
      { name: "Ali Stores" },
    );
    await call(owner, "PUT", `/task/contact/${task.id}`, {
      contactId: contact.body.id,
    });

    mockAnonymousSession();
    const { app } = createApp();
    const response = await app.request(`/api/public-project/${project.id}`);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Follow up");
    expect(text).not.toContain(contact.body.id);
    expect(text).not.toContain("contactId");
  });
});
