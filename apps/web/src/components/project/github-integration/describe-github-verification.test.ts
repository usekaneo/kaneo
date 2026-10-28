import { describe, expect, it } from "vite-plus/test";
import type { VerifyGithubInstallationResponse } from "@/fetchers/github-integration/verify-github-installation";
import {
  describeGithubVerification,
  githubVerificationTone,
  isGithubVerificationReady,
} from "./describe-github-verification";

function result(
  overrides: Partial<VerifyGithubInstallationResponse>,
): VerifyGithubInstallationResponse {
  return {
    isInstalled: true,
    installationId: 1,
    repositoryExists: true,
    repositoryPrivate: false,
    permissions: null,
    hasRequiredPermissions: true,
    missingPermissions: [],
    message: "Server message",
    ...overrides,
  };
}

describe("describeGithubVerification", () => {
  it("is ready when the App is installed with the required permissions", () => {
    const outcome = describeGithubVerification(result({}));
    expect(outcome).toEqual({ kind: "ready" });
    expect(githubVerificationTone(outcome)).toBe("success");
    expect(isGithubVerificationReady(result({}))).toBe(true);
  });

  it("lists missing permissions with the settings link", () => {
    const outcome = describeGithubVerification(
      result({
        hasRequiredPermissions: false,
        missingPermissions: ["issues"],
        settingsUrl: "https://github.com/settings/installations/1",
      }),
    );
    expect(outcome).toEqual({
      kind: "missingPermissions",
      permissions: ["issues"],
      settingsUrl: "https://github.com/settings/installations/1",
    });
    expect(githubVerificationTone(outcome)).toBe("warning");
  });

  it("offers the install link when the App is not installed", () => {
    const outcome = describeGithubVerification(
      result({
        isInstalled: false,
        repositoryExists: null,
        hasRequiredPermissions: false,
        installationUrl: "https://github.com/apps/kaneo/installations/new",
      }),
    );
    expect(outcome).toEqual({
      kind: "notInstalled",
      installationUrl: "https://github.com/apps/kaneo/installations/new",
    });
    expect(githubVerificationTone(outcome)).toBe("destructive");
  });

  it("falls back to the server message", () => {
    const outcome = describeGithubVerification(
      result({ repositoryExists: false, hasRequiredPermissions: false }),
    );
    expect(outcome).toEqual({ kind: "message", message: "Server message" });
    expect(isGithubVerificationReady(undefined)).toBe(false);
  });
});
