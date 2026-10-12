import { describe, expect, it } from "vite-plus/test";
import type { GetConfigResponse } from "@/fetchers/config/get-config";
import {
  getEmailMethod,
  getProviders,
  getSafeRedirectPath,
  getSignInFooter,
  getSignInSubtitleKey,
  getSignUpEmailMethod,
} from "./auth-methods";

function config(overrides: Partial<GetConfigResponse> = {}) {
  return {
    isCloud: false,
    disableRegistration: false,
    disablePasswordRegistration: false,
    disableEmailOtpSignIn: false,
    disableWorkspaceCreation: false,
    isDemoMode: false,
    hasSmtp: true,
    hasImageUploads: false,
    hasGithubSignIn: false,
    hasGoogleSignIn: false,
    hasDiscordSignIn: false,
    hasCustomOAuth: false,
    hasGuestAccess: false,
    disableLoginForm: false,
    customOAuthName: null,
    customOAuthAutoLogin: false,
    customOAuthLogoutUrl: null,
    billingEnabled: false,
    ...overrides,
  } satisfies GetConfigResponse;
}

describe("auth methods", () => {
  it("lists configured providers in a fixed order", () => {
    expect(
      getProviders(
        config({
          hasCustomOAuth: true,
          hasDiscordSignIn: true,
          hasGoogleSignIn: true,
        }),
      ),
    ).toEqual(["google", "discord", "custom"]);
    expect(getProviders(undefined)).toEqual([]);
  });

  it.each([
    [{}, "code"],
    [{ hasSmtp: false }, "password"],
    [{ disableEmailOtpSignIn: true }, "password"],
    [{ disableLoginForm: true }, null],
  ] as const)("picks the email sign-in method for %j", (overrides, method) => {
    expect(getEmailMethod(config(overrides))).toBe(method);
  });

  it("signs up with the same method as sign-in, except during instance setup", () => {
    expect(getSignUpEmailMethod(config(), false)).toBe("code");
    expect(getSignUpEmailMethod(config({ hasSmtp: false }), false)).toBe(
      "password",
    );
    expect(getSignUpEmailMethod(config(), true)).toBe("password");
    expect(
      getSignUpEmailMethod(
        config({ disablePasswordRegistration: true }),
        false,
      ),
    ).toBeNull();
    expect(
      getSignUpEmailMethod(config({ disableLoginForm: true }), false),
    ).toBeNull();
  });

  it.each([
    [{}, "code", ["github"], "createAccount"],
    [{ disableRegistration: true }, "code", ["github"], "inviteOnly"],
    [
      { disablePasswordRegistration: true },
      "code",
      ["github"],
      "providerSignUp",
    ],
    [{ disablePasswordRegistration: true }, "code", [], "inviteOnly"],
    [{}, null, ["google", "github"], "anyProvider"],
    [{}, null, ["custom"], "contactAdmin"],
    [{}, null, [], "contactAdmin"],
  ] as const)(
    "chooses the sign-in footer for %j with %s and %j",
    (overrides, method, providers, footer) => {
      expect(getSignInFooter(config(overrides), method, [...providers])).toBe(
        footer,
      );
    },
  );

  it.each([
    ["code", ["github"], "auth:signIn.subtitle.emailOrProvider"],
    ["code", [], "auth:signIn.subtitle.email"],
    ["password", ["discord"], "auth:signIn.subtitle.passwordOrProvider"],
    ["password", [], "auth:signIn.subtitle.password"],
    [null, ["google", "github"], "auth:signIn.subtitle.providers"],
    [null, ["custom"], "auth:signIn.subtitle.sso"],
  ] as const)("describes %s with %j", (method, providers, key) => {
    expect(getSignInSubtitleKey(method, [...providers])).toBe(key);
  });

  it.each([
    ["/dashboard/settings", "/dashboard/settings"],
    ["//evil.example", undefined],
    ["https://evil.example", undefined],
    [undefined, undefined],
  ])("only keeps same-origin redirect %s", (path, expected) => {
    expect(getSafeRedirectPath(path)).toBe(expected);
  });
});
