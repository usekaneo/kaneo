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
        "hasGithubSignIn",
        "hasGoogleSignIn",
        "hasDiscordSignIn",
        "hasCustomOAuth",
      ].every((key) => typeof value[key] === "boolean"),
    );
  });

  it("returns the trimmed custom OAuth name when one is set", async () => {
    vi.stubEnv("CUSTOM_OAUTH_NAME", "  Authentik ");
    const response = await createApp().app.request("/api/config");
    expect(await response.json()).toHaveProperty(
      "customOAuthName",
      "Authentik",
    );
  });
});
