import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";

describe("API integration: config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["true", "false", undefined])(
    "returns cloud mode for KANEO_CLOUD=%s",
    async (value) => {
      vi.stubEnv("KANEO_CLOUD", value);
      const response = await createApp().app.request("/api/config");
      expect(response.status).toBe(200);
      expect(await response.json()).toHaveProperty("isCloud", value === "true");
    },
  );

  it("returns the public config shape", async () => {
    const { app } = createApp();

    const response = await app.request("/api/config");

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({
      disableRegistration: false,
      disablePasswordRegistration: false,
      disableEmailOtpSignIn: false,
      disableLoginForm: false,
      customOAuthName: null,
      customOAuthAutoLogin: false,
      isDemoMode: false,
      hasGuestAccess: true,
    });
    expect(payload).toSatisfy((value: Record<string, unknown>) =>
      [
        "hasSmtp",
        "hasImageUploads",
        "hasGithubSignIn",
        "hasGoogleSignIn",
        "hasDiscordSignIn",
        "hasCustomOAuth",
      ].every((key) => typeof value[key] === "boolean"),
    );
  });

  it.each([
    [{ S3_ENDPOINT: "https://s3.example.com", S3_BUCKET: "kaneo" }, true],
    [{ S3_ENDPOINT: "", S3_BUCKET: "" }, false],
  ])(
    "reports image uploads from the storage settings %o",
    async (storage, expected) => {
      for (const [key, value] of Object.entries(storage)) {
        vi.stubEnv(key, value);
      }
      const response = await createApp().app.request("/api/config");
      expect(await response.json()).toHaveProperty("hasImageUploads", expected);
    },
  );

  it("returns the trimmed custom OAuth name when one is set", async () => {
    vi.stubEnv("CUSTOM_OAUTH_NAME", "  Authentik ");
    const response = await createApp().app.request("/api/config");
    expect(await response.json()).toHaveProperty(
      "customOAuthName",
      "Authentik",
    );
  });
});
