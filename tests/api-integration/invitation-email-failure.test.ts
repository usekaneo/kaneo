import * as email from "@kaneo/email";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

beforeEach(async () => {
  await resetTestDatabase();
});
const origin = "http://localhost:5173";
function post(path: string, body: unknown, cookie = "") {
  return createApp().app.request(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
}
async function signedIn() {
  const response = await post("/sign-up/email", {
    name: "Account",
    email: "account@example.com",
    password: "original-password",
  });
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

describe("invitation email failure reporting", () => {
  it("reports failed send and resend, keeps the pending invitation, and allows retry", async () => {
    const cookie = await signedIn();
    const created = await post(
      "/organization/create",
      { name: "Invites", slug: "invites" },
      cookie,
    );
    expect(created.status).toBe(200);
    const organization = await created.json();
    const send = vi
      .spyOn(email, "sendWorkspaceInvitationEmail")
      .mockRejectedValue(new Error("private SMTP error"));
    const body = {
      organizationId: organization.id,
      email: "invitee@example.com",
      role: "member",
    };
    const failed = await post("/organization/invite-member", body, cookie);
    expect(failed.status).toBe(502);
    expect(await failed.json()).toMatchObject({
      code: "INVITATION_EMAIL_FAILED",
    });
    expect(await db.select().from(schema.invitationTable)).toHaveLength(1);
    expect(
      (
        await post(
          "/organization/invite-member",
          { ...body, resend: true },
          cookie,
        )
      ).status,
    ).toBe(502);
    send.mockResolvedValue({ success: true });
    expect(
      (
        await post(
          "/organization/invite-member",
          { ...body, resend: true },
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(await db.select().from(schema.invitationTable)).toHaveLength(1);
    // The strict invitation behavior must not replace the global background handler.
    await expect(
      (await auth.$context).runInBackgroundOrAwait(
        Promise.reject(new Error("background")),
      ),
    ).resolves.toBeUndefined();
  });
});
