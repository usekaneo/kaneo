import { describe, expect, it } from "vite-plus/test";
import { buildCreateUserRequest } from "./create-user-values";
import { getAccountSetupMode } from "./get-account-setup-mode";

describe("buildCreateUserRequest", () => {
  it("trims the name and normalizes the email", () => {
    expect(
      buildCreateUserRequest({
        name: "  Nora New ",
        email: " Nora@Example.COM ",
        role: "admin",
      }),
    ).toEqual({ name: "Nora New", email: "nora@example.com", role: "admin" });
  });

  it("needs a name and an email", () => {
    expect(
      buildCreateUserRequest({ name: " ", email: "a@b.c", role: "user" }),
    ).toBeNull();
    expect(
      buildCreateUserRequest({ name: "A", email: " ", role: "user" }),
    ).toBeNull();
  });
});

describe("getAccountSetupMode", () => {
  it("emails a password link by default", () => {
    expect(getAccountSetupMode({ hasSmtp: true })).toBe("email");
    expect(getAccountSetupMode(undefined)).toBe("email");
  });

  it("warns when email delivery is not configured", () => {
    expect(getAccountSetupMode({ hasSmtp: false })).toBe("noEmail");
  });

  it("creates single sign-on accounts when password sign-up or sign-in is off", () => {
    expect(
      getAccountSetupMode({
        hasSmtp: false,
        disablePasswordRegistration: true,
      }),
    ).toBe("sso");
    expect(getAccountSetupMode({ hasSmtp: true, disableLoginForm: true })).toBe(
      "sso",
    );
  });
});
