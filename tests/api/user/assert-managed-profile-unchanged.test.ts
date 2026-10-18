import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { getManagedProfile } = vi.hoisted(() => ({
  getManagedProfile: vi.fn(),
}));

vi.mock("../../../apps/api/src/user/controllers/get-managed-profile", () => ({
  default: getManagedProfile,
  getManagedProfile,
}));

const { assertManagedProfileUnchanged } =
  await import("../../../apps/api/src/user/controllers/assert-managed-profile-unchanged");

const refusal = {
  status: "FORBIDDEN",
  body: { code: "PROFILE_FIELD_MANAGED_BY_PROVIDER" },
};

function hookContext(
  path: string | undefined,
  sessionUserId: string,
  body: { userId?: string } = {},
) {
  return { path, body, context: { session: { user: { id: sessionUserId } } } };
}

describe("assertManagedProfileUnchanged", () => {
  beforeEach(() => {
    vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name");
    getManagedProfile.mockReset();
    getManagedProfile.mockResolvedValue({
      fields: ["name"],
      stored: { name: "Jane Doe", image: null, locale: "en-US" },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("checks the signed-in user's own profile on /update-user", async () => {
    await expect(
      assertManagedProfileUnchanged(
        { name: "Janet" },
        hookContext("/update-user", "self"),
      ),
    ).rejects.toMatchObject(refusal);
    expect(getManagedProfile).toHaveBeenCalledWith("self");
  });

  it("checks the target user, not the admin, on /admin/update-user", async () => {
    await expect(
      assertManagedProfileUnchanged(
        { name: "Janet" },
        hookContext("/admin/update-user", "admin", { userId: "target" }),
      ),
    ).rejects.toMatchObject(refusal);
    expect(getManagedProfile).toHaveBeenCalledWith("target");
    expect(getManagedProfile).not.toHaveBeenCalledWith("admin");
  });

  it.each(["/oauth2/callback/:providerId", "/verify-email", undefined])(
    "leaves user updates on %p alone",
    async (path) => {
      await expect(
        assertManagedProfileUnchanged(
          { name: "Janet" },
          hookContext(path, "self"),
        ),
      ).resolves.toBeUndefined();
      expect(getManagedProfile).not.toHaveBeenCalled();
    },
  );

  it("accepts the stored value sent again", async () => {
    await expect(
      assertManagedProfileUnchanged(
        { name: "Jane Doe" },
        hookContext("/update-user", "self"),
      ),
    ).resolves.toBeUndefined();
  });
});
