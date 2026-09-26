import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { resolveVerificationToken } from "../../apps/api/src/gitea-integration/controllers/resolve-verification-token";
import verifyGiteaAccess from "../../apps/api/src/gitea-integration/controllers/verify-gitea-access";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock(
  "../../apps/api/src/gitea-integration/controllers/verify-gitea-access",
  () => ({
    default: vi.fn(async () => ({
      isInstalled: true,
      hasRequiredPermissions: true,
      repositoryExists: true,
      repositoryPrivate: false,
      missingPermissions: [],
      message: "Verified",
      failureReason: null,
    })),
  }),
);
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});
async function fixture(baseUrl = "https://gitea.example") {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "gitea",
    config: JSON.stringify({
      baseUrl,
      accessToken: "saved-secret",
    }),
  });
  mockAuthenticatedSession(owner.user);
  return { project };
}
function verify(projectId: string, baseUrl = "https://gitea.example") {
  return createApp().app.request("/api/gitea-integration/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      baseUrl,
      repositoryOwner: "owner",
      repositoryName: "repo",
    }),
  });
}
describe("saved Gitea token verification route", () => {
  it("verifies the saved token without returning it", async () => {
    const { project } = await fixture();
    const response = await verify(project.id);
    expect(response.status).toBe(200);
    expect(verifyGiteaAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: project.id,
        accessToken: "saved-secret",
      }),
    );
    expect(await response.text()).not.toContain("saved-secret");
  });
  it("rejects another destination before any outbound verification", async () => {
    const { project } = await fixture();
    expect((await verify(project.id, "https://other.example")).status).toBe(
      400,
    );
    expect(verifyGiteaAccess).not.toHaveBeenCalled();
  });
  it.each([
    "ftp://gitea.example",
    "https://gitea.example?token=secret",
    "https://gitea.example#fragment",
    "https://user:secret@gitea.example",
  ])(
    "rejects invalid submitted URL %s without verification",
    async (baseUrl) => {
      const { project } = await fixture();
      const response = await verify(project.id, baseUrl);
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain("secret");
      expect(verifyGiteaAccess).not.toHaveBeenCalled();
    },
  );
  it("reports malformed saved configuration without revealing it", async () => {
    const { project } = await fixture("https://user:secret@gitea.example");
    const response = await verify(project.id);
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain("Reconnect the integration");
    expect(body).not.toContain("secret");
    expect(verifyGiteaAccess).not.toHaveBeenCalled();
  });
  it("requires workspace management permission to use stored credentials", async () => {
    const { project } = await fixture();
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    expect((await verify(project.id)).status).toBe(403);
    expect(verifyGiteaAccess).not.toHaveBeenCalled();
  });
  it("uses a saved Gitea token only for its project and unchanged destination", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db.insert(schema.integrationTable).values({
      projectId: project.id,
      type: "gitea",
      config: JSON.stringify({
        baseUrl: "https://gitea.example",
        accessToken: "stored-token",
      }),
    });
    const input = { projectId: project.id, baseUrl: "https://gitea.example/" };
    expect(await resolveVerificationToken(input)).toBe("stored-token");
    await expect(
      resolveVerificationToken({ ...input, baseUrl: "https://other.example" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      resolveVerificationToken({ ...input, projectId: "other-project" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      await resolveVerificationToken({
        ...input,
        baseUrl: "https://other.example",
        accessToken: "new-token",
      }),
    ).toBe("new-token");
  });
});
