import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  config: vi.fn(),
  verify: vi.fn(),
  getRepo: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      projectTable: { findFirst: async () => ({ id: "project" }) },
      integrationTable: { findFirst: m.config, findMany: async () => [] },
    },
    update: () => ({
      set: m.save.mockReturnValue({
        where: () => ({
          returning: async () => [
            { id: "integration", projectId: "project", isActive: true },
          ],
        }),
      }),
    }),
  },
}));
vi.mock("../../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  GiteaApiError: class extends Error {},
  verifyGiteaToken: m.verify,
  createGiteaClient: () => ({ getRepo: m.getRepo }),
}));
const { default: reconnect } =
  await import("../../../apps/api/src/gitea-integration/controllers/create-gitea-integration");
const input = {
  projectId: "project",
  baseUrl: "https://gitea.example",
  accessToken: undefined,
  repositoryOwner: "owner",
  repositoryName: "repo",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.config.mockResolvedValue({
    id: "integration",
    config: JSON.stringify({
      baseUrl: "https://gitea.example/",
      accessToken: "saved-token",
    }),
  });
});
describe("gitea reconnect credentials", () => {
  it("rejects a changed destination before sending the saved token", async () => {
    await expect(
      reconnect({ ...input, baseUrl: "https://attacker.example" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.getRepo).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });
  it("reuses credentials only for the same normalized destination", async () => {
    await reconnect(input);
    expect(m.verify).toHaveBeenCalledWith(
      "https://gitea.example",
      "saved-token",
    );
  });
  it("allows a changed destination with an explicitly supplied token", async () => {
    await reconnect({
      ...input,
      baseUrl: "https://new-gitea.example",
      accessToken: " new-token ",
    });
    expect(m.verify).toHaveBeenCalledWith(
      "https://new-gitea.example",
      "new-token",
    );
  });
  it("rejects invalid saved configuration without contacting a provider", async () => {
    m.config.mockResolvedValue({ id: "integration", config: "{" });
    await expect(reconnect(input)).rejects.toMatchObject({ status: 400 });
    expect(m.verify).not.toHaveBeenCalled();
  });
});
