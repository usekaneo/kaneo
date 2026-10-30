import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getAdminAccess } from "./get-admin-access";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@kaneo/libs", () => ({
  client: { admin: { access: { $get: mocks.get } } },
}));

describe("getAdminAccess", () => {
  beforeEach(() => {
    mocks.get.mockReset();
  });

  it("returns the server's permissions", async () => {
    mocks.get.mockResolvedValue({
      ok: true,
      json: async () => ({ permissions: ["users:read"] }),
    });

    await expect(getAdminAccess()).resolves.toEqual(["users:read"]);
  });

  it("rethrows failures so a blip is not treated as having no access", async () => {
    mocks.get.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ message: "bad gateway" }),
    });

    await expect(getAdminAccess()).rejects.toThrow("bad gateway");
  });
});
