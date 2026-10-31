import * as v from "valibot";
import { describe, expect, it } from "vite-plus/test";
import { tangledConfigSchema } from "./config";

const validConfig = {
  origin: "https://tangled.org",
  repositoryFullName: "did:plc:abc123/main",
  repositoryDid: "did:plc:sjazesp3pinxlmgju2va46jd",
  repositoryUrl: "https://tangled.org/@alice/project",
  branchPattern: "{slug}-{number}",
  webhookSecret: "secret",
  active: true,
};

describe("tangledConfigSchema", () => {
  it("accepts a valid Tangled configuration", () => {
    expect(v.safeParse(tangledConfigSchema, validConfig).success).toBe(true);
  });

  it.each([
    "http://tangled.org",
    "https://user:pass@tangled.org",
    "https://tangled.org/path",
    "https://tangled.org?query=1",
    "https://tangled.org#fragment",
    "https://tangled.org:8443",
    "https://127.0.0.1",
    "https://[::1]",
  ])("rejects an invalid origin: %s", (origin) => {
    expect(
      v.safeParse(tangledConfigSchema, { ...validConfig, origin }).success,
    ).toBe(false);
  });

  it.each(["http://tangled.org/repo", "https://user:pass@tangled.org/repo"])(
    "rejects an invalid display repository URL: %s",
    (repositoryUrl) => {
      expect(
        v.safeParse(tangledConfigSchema, { ...validConfig, repositoryUrl })
          .success,
      ).toBe(false);
    },
  );

  it("accepts record keys beyond a narrow fixed pattern", () => {
    expect(
      v.safeParse(tangledConfigSchema, {
        ...validConfig,
        repositoryFullName: "did:web:example.com:users:alice/com.example.repo",
      }).success,
    ).toBe(true);
  });

  it.each([
    "",
    "did:plc:abc123",
    "/repo",
    "owner/",
    "did:/repo",
    "did:plc:owner/rkey/extra",
    "did:plc:owner/..",
    "did:plc:owner/ ",
  ])(
    "rejects malformed signed repository full_name: %s",
    (repositoryFullName) => {
      expect(
        v.safeParse(tangledConfigSchema, { ...validConfig, repositoryFullName })
          .success,
      ).toBe(false);
    },
  );

  it.each(["", "feature/{slug}", "custom"])(
    "rejects invalid branch pattern: %s",
    (branchPattern) => {
      expect(
        v.safeParse(tangledConfigSchema, { ...validConfig, branchPattern })
          .success,
      ).toBe(false);
    },
  );

  it("requires a repository DID distinct from the webhook full name", () => {
    const { repositoryDid: _did, ...legacyConfig } = validConfig;
    expect(v.safeParse(tangledConfigSchema, legacyConfig).success).toBe(false);
    expect(
      v.safeParse(tangledConfigSchema, {
        ...validConfig,
        repositoryDid: validConfig.repositoryFullName,
      }).success,
    ).toBe(false);
  });

  it("requires a nonempty secret and boolean active value", () => {
    expect(
      v.safeParse(tangledConfigSchema, { ...validConfig, webhookSecret: "" })
        .success,
    ).toBe(false);
    expect(
      v.safeParse(tangledConfigSchema, { ...validConfig, active: "true" })
        .success,
    ).toBe(false);
  });
});
