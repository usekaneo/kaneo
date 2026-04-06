import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGithubSsoOAuthCredentials,
  isGithubSsoConfigured,
} from "../../../apps/api/src/utils/github-sso-env";

const keys = [
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
] as const;

describe("github-sso-env", () => {
  const original: Partial<Record<(typeof keys)[number], string | undefined>> =
    {};

  beforeEach(() => {
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("prefers GITHUB_OAUTH_* when both are set", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "oauth-id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "oauth-secret";
    process.env.GITHUB_CLIENT_ID = "legacy-id";
    process.env.GITHUB_CLIENT_SECRET = "legacy-secret";
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "oauth-id",
      clientSecret: "oauth-secret",
    });
    expect(isGithubSsoConfigured()).toBe(true);
  });

  it("falls back to legacy GITHUB_CLIENT_* when OAuth vars are unset", () => {
    process.env.GITHUB_CLIENT_ID = "legacy-id";
    process.env.GITHUB_CLIENT_SECRET = "legacy-secret";
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "legacy-id",
      clientSecret: "legacy-secret",
    });
    expect(isGithubSsoConfigured()).toBe(true);
  });

  it("returns empty credentials when nothing is configured", () => {
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "",
      clientSecret: "",
    });
    expect(isGithubSsoConfigured()).toBe(false);
  });

  it("treats partial OAuth pair as absent and falls back to legacy", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "only-id";
    process.env.GITHUB_CLIENT_ID = "legacy-id";
    process.env.GITHUB_CLIENT_SECRET = "legacy-secret";
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "legacy-id",
      clientSecret: "legacy-secret",
    });
  });
});
