import { describe, expect, it } from "vitest";
import { isOAuthCallbackPath } from "../../../apps/api/src/utils/is-oauth-callback-path";

describe("isOAuthCallbackPath", () => {
  it.each(["/callback/custom", "/callback/google", "/oauth2/callback/custom"])(
    "recognizes %s as an OAuth callback",
    (path) => {
      expect(isOAuthCallbackPath(path)).toBe(true);
    },
  );

  it.each([
    "/sign-in/social",
    "/sign-in/email",
    "/get-session",
    "/callback",
    "/oauth2/callback",
  ])("does not treat %s as an OAuth callback", (path) => {
    expect(isOAuthCallbackPath(path)).toBe(false);
  });

  it.each([undefined, null, 42])(
    "returns false for non-string input %s",
    (path) => {
      expect(isOAuthCallbackPath(path)).toBe(false);
    },
  );
});
