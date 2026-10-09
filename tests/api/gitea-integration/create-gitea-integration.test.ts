import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  config: vi.fn(),
  verify: vi.fn(),
  getRepo: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../../../apps/api/src/database", () => {
  const database = {
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
  };
  return {
    default: {
      ...database,
      transaction: async (apply: (tx: typeof database) => Promise<unknown>) =>
        apply(database),
    },
  };
});
vi.mock(
  "../../../apps/api/src/plugins/gitea/utils/gitea-api",
  async (original) => ({
    ...(await original<object>()),
    GiteaApiError: class extends Error {},
    verifyGiteaToken: m.verify,
    createGiteaClient: () => ({ getRepo: m.getRepo }),
  }),
);
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
  it("rejects invalid saved configuration without contacting a provider", async () => {
    m.config.mockResolvedValue({ id: "integration", config: "{" });
    await expect(reconnect(input)).rejects.toMatchObject({ status: 400 });
    expect(m.verify).not.toHaveBeenCalled();
  });
});
