import { describe, expect, it } from "vitest";
import { isLocalSignInPath } from "../../../apps/api/src/utils/is-local-sign-in-path";

describe("isLocalSignInPath", () => {
  it.each([
    "/sign-in/email",
    "/sign-in/magic-link",
    "/magic-link/verify",
    "/sign-in/email-otp",
    "/email-otp/send-verification-otp",
  ])("blocks %s", (path) => {
    expect(isLocalSignInPath(path)).toBe(true);
  });

  it.each([
    "/sign-in/social",
    "/callback/google",
    "/get-session",
  ])("allows %s", (path) => {
    expect(isLocalSignInPath(path)).toBe(false);
  });
});
