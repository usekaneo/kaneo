import { eq } from "drizzle-orm";
import { expect, vi } from "vite-plus/test";
import db, { schema } from "../../../apps/api/src/database";
import { createApp } from "../../../apps/api/src/index";
import { signUpWithSession } from "./auth-session";
import { createProjectFixture } from "./fixtures";

// Keep asynchronous notification subscribers from racing database resets.
vi.mock("../../../apps/api/src/events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../apps/api/src/events")>()),
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

type App = ReturnType<typeof createApp>["app"];

export async function organizationRequest(
  app: App,
  headers: Record<string, string>,
  operation: string,
  body: Record<string, unknown>,
) {
  return app.request(`/api/auth/organization/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

export async function invitationSecurityFixture(actorRole = "recruiter") {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    email: "owner@example.com",
    name: "Owner",
    role: "user",
  });
  const actor = await signUpWithSession(app, {
    email: "actor@example.com",
    name: "Inviter",
    role: "user",
  });
  const created = await organizationRequest(
    app,
    { cookie: owner.cookies },
    "create",
    { name: "Invitation security", slug: "invitation-security" },
  );
  expect(created.status).toBe(200);
  const workspace = (await created.json()) as { id: string };
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: workspace.id,
    role: "recruiter",
    permission: JSON.stringify({ invitation: ["create"] }),
  });
  const [membership] = await db
    .insert(schema.workspaceUserTable)
    .values({
      workspaceId: workspace.id,
      userId: actor.userId,
      role: actorRole,
      joinedAt: new Date(),
    })
    .returning();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });

  const invite = (
    cookies: string,
    role: unknown,
    extra: Record<string, unknown> = {},
  ) =>
    organizationRequest(app, { cookie: cookies }, "invite-member", {
      organizationId: workspace.id,
      email: "invitee@example.com",
      role,
      ...extra,
    });
  const pending = async (role: string) => {
    const [invitation] = await db
      .insert(schema.invitationTable)
      .values({
        workspaceId: workspace.id,
        inviterId: owner.userId,
        email: "invitee@example.com",
        role,
        status: "pending",
        projectAccess: "selected",
        projectIds: [project.id],
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    return invitation;
  };
  const accept = async (invitationId: string) => {
    const invitee = await signUpWithSession(app, {
      email: "invitee@example.com",
      name: "Invitee",
      role: "user",
    });
    const response = await organizationRequest(
      app,
      { cookie: invitee.cookies },
      "accept-invitation",
      { invitationId },
    );
    return { response, invitee };
  };
  const bearer = async () => {
    const session = await db.query.sessionTable.findFirst({
      where: eq(schema.sessionTable.userId, actor.userId),
    });
    return { authorization: `Bearer ${session!.token}` };
  };
  return {
    app,
    owner,
    actor,
    workspace,
    membership,
    project,
    invite,
    pending,
    accept,
    bearer,
  };
}
