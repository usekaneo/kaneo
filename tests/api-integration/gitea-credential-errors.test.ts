import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../apps/api/src/index";
import {
  GiteaApiError,
  verifyGiteaToken,
} from "../../apps/api/src/plugins/gitea/utils/gitea-api";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock(
  "../../apps/api/src/plugins/gitea/utils/gitea-api",
  async (original) => ({
    ...(await original<object>()),
    verifyGiteaToken: vi.fn(),
  }),
);

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  vi.mocked(verifyGiteaToken).mockRejectedValue(
    new GiteaApiError("Invalid token", 401, "HTTP_ERROR"),
  );
});

describe("Gitea credentials are not Kaneo session credentials", () => {
  it.each(["verify", "repositories"])(
    "returns 400 for invalid upstream credentials on %s, but 401 for a missing session",
    async (endpoint) => {
      const owner = await createWorkspaceMember({ role: "owner" });
      const { project } = await createProjectFixture({
        workspaceId: owner.workspace.id,
      });
      const { app } = createApp();
      const request = () =>
        app.request(`/api/gitea-integration/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            baseUrl: "https://gitea.example",
            accessToken: "invalid-secret",
            repositoryOwner: "owner",
            repositoryName: "repo",
          }),
        });
      mockAuthenticatedSession(owner.user);
      const response = await request();
      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toContain("Invalid Gitea token");
      expect(body).not.toContain("invalid-secret");
      vi.mocked(verifyGiteaToken).mockClear();
      mockAnonymousSession();
      expect((await request()).status).toBe(401);
      expect(verifyGiteaToken).not.toHaveBeenCalled();
    },
  );
});
