import { beforeEach, describe, expect, it, vi } from "vitest";

const { hasPermission } = vi.hoisted(() => ({ hasPermission: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
  authClient: { admin: { hasPermission } },
}));

import { getAdminAccess } from "./get-admin-access";

describe("getAdminAccess", () => {
  beforeEach(() => {
    hasPermission.mockReset();
  });

  it.each([401, 403])("resolves to false on %d", async (status) => {
    hasPermission.mockResolvedValue({
      data: null,
      error: { status, message: "nope" },
    });

    await expect(getAdminAccess()).resolves.toBe(false);
  });

  it("rethrows other failures so a blip is not treated as denial", async () => {
    hasPermission.mockResolvedValue({
      data: null,
      error: { status: 502, message: "bad gateway" },
    });

    await expect(getAdminAccess()).rejects.toThrow("bad gateway");
  });

  it.each([true, false])("returns the server's answer %s", async (success) => {
    hasPermission.mockResolvedValue({ data: { success }, error: null });

    await expect(getAdminAccess()).resolves.toBe(success);
  });
});
