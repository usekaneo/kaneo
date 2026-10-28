import { describe, expect, it } from "vite-plus/test";
import { getSignInMethodLabel } from "./get-sign-in-method-label";

const t = (key: string) => `t:${key}`;

describe("getSignInMethodLabel", () => {
  it("names passwords and built-in providers", () => {
    expect(getSignInMethodLabel("credential", t, null)).toBe(
      "t:settings:adminUsers.details.methods.password",
    );
    expect(getSignInMethodLabel("github", t, null)).toBe(
      "t:auth:providers.github",
    );
  });

  it("uses the configured OIDC provider name", () => {
    expect(getSignInMethodLabel("custom", t, "Acme ID")).toBe("Acme ID");
    expect(getSignInMethodLabel("custom", t, null)).toBe(
      "t:auth:providers.sso",
    );
  });

  it("shows unknown provider ids as they are", () => {
    expect(getSignInMethodLabel("magic-link", t, null)).toBe("magic-link");
  });
});
