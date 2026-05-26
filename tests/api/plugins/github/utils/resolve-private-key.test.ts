import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveGithubPrivateKey } from "../../../../../apps/api/src/plugins/github/utils/github-app";

const PEM = [
  "-----BEGIN RSA PRIVATE KEY-----",
  "MIIEpAIBAAKCAQEA",
  "abc",
  "-----END RSA PRIVATE KEY-----",
].join("\n");

describe("resolveGithubPrivateKey", () => {
  const originalKey = process.env.GITHUB_PRIVATE_KEY;
  const originalB64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

  beforeEach(() => {
    delete process.env.GITHUB_PRIVATE_KEY;
    delete process.env.GITHUB_PRIVATE_KEY_BASE64;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.GITHUB_PRIVATE_KEY;
    } else {
      process.env.GITHUB_PRIVATE_KEY = originalKey;
    }
    if (originalB64 === undefined) {
      delete process.env.GITHUB_PRIVATE_KEY_BASE64;
    } else {
      process.env.GITHUB_PRIVATE_KEY_BASE64 = originalB64;
    }
  });

  it("returns an empty string when nothing is set", () => {
    expect(resolveGithubPrivateKey()).toBe("");
  });

  it("returns the raw value when GITHUB_PRIVATE_KEY is real multi-line PEM", () => {
    process.env.GITHUB_PRIVATE_KEY = PEM;
    expect(resolveGithubPrivateKey()).toBe(PEM);
  });

  it("unescapes literal \\n separators when the env contains no real newlines", () => {
    // Simulates the Portainer form-field case: real newlines stripped,
    // user replaced them with literal "\n".
    process.env.GITHUB_PRIVATE_KEY = PEM.replace(/\n/g, "\\n");
    expect(resolveGithubPrivateKey()).toBe(PEM);
  });

  it("does not touch values that already have real newlines", () => {
    // Mixed content (real newlines + literal \n inside data) must not be
    // mangled. Real newlines win; \\n stays as-is.
    const mixed = "line1\nliteral\\nstays\nline3";
    process.env.GITHUB_PRIVATE_KEY = mixed;
    expect(resolveGithubPrivateKey()).toBe(mixed);
  });

  it("decodes GITHUB_PRIVATE_KEY_BASE64 when set", () => {
    process.env.GITHUB_PRIVATE_KEY_BASE64 = Buffer.from(PEM).toString("base64");
    expect(resolveGithubPrivateKey()).toBe(PEM);
  });

  it("prefers GITHUB_PRIVATE_KEY_BASE64 over GITHUB_PRIVATE_KEY when both are set", () => {
    process.env.GITHUB_PRIVATE_KEY = "stale-value";
    process.env.GITHUB_PRIVATE_KEY_BASE64 = Buffer.from(PEM).toString("base64");
    expect(resolveGithubPrivateKey()).toBe(PEM);
  });

  it("falls back to GITHUB_PRIVATE_KEY when the base64 env is empty/whitespace", () => {
    process.env.GITHUB_PRIVATE_KEY_BASE64 = "   ";
    process.env.GITHUB_PRIVATE_KEY = PEM;
    expect(resolveGithubPrivateKey()).toBe(PEM);
  });
});
