import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { getManagedProfile } = vi.hoisted(() => ({
  getManagedProfile: vi.fn(),
}));

vi.mock("../../../apps/api/src/user/controllers/get-managed-profile", () => ({
  default: getManagedProfile,
  getManagedProfile,
}));

const { requireRemovableAvatar, requireUnmanagedAvatar } =
  await import("../../../apps/api/src/user/managed-avatar-guards");

const context = { get: () => "user-1" } as unknown as Context;

const refusal = { status: 403, code: "PROFILE_FIELD_MANAGED_BY_PROVIDER" };

function managedProfile(fields: string[], image: string | null) {
  return { fields, stored: { name: "Jane Doe", image, locale: null } };
}

describe("managed avatar guards", () => {
  beforeEach(() => {
    getManagedProfile.mockReset();
  });

  it("refuses an upload while the provider manages the picture", async () => {
    getManagedProfile.mockResolvedValue(managedProfile(["image"], null));
    const next = vi.fn(async () => {});

    await expect(requireUnmanagedAvatar(context, next)).rejects.toMatchObject(
      refusal,
    );
    expect(next).not.toHaveBeenCalled();
    expect(getManagedProfile).toHaveBeenCalledWith("user-1");
  });

  it.each([
    ["people without a provider account", null],
    ["a picture the provider does not manage", managedProfile(["name"], null)],
  ])("allows an upload for %s", async (_name, managed) => {
    getManagedProfile.mockResolvedValue(managed);
    const next = vi.fn(async () => {});

    await requireUnmanagedAvatar(context, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(["/api/user/avatar/abc", null])(
    "allows removing while the stored picture is %p",
    async (image) => {
      getManagedProfile.mockResolvedValue(managedProfile(["image"], image));
      const next = vi.fn(async () => {});

      await requireRemovableAvatar(context, next);
      expect(next).toHaveBeenCalledOnce();
    },
  );

  it("refuses removing the provider's picture", async () => {
    getManagedProfile.mockResolvedValue(
      managedProfile(["image"], "https://id.example.com/jane.png"),
    );
    const next = vi.fn(async () => {});

    await expect(requireRemovableAvatar(context, next)).rejects.toMatchObject(
      refusal,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("allows people without a provider account to remove any picture", async () => {
    getManagedProfile.mockResolvedValue(null);
    const next = vi.fn(async () => {});

    await requireRemovableAvatar(context, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
