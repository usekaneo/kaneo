import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyKeyPrefix,
  assertStorageConfigured,
  assertTaskImageKeyMatchesContext,
  buildObjectKey,
  buildObjectKeyPrefix,
  createTaskImageUploadUrl,
  getFileExtension,
  isImageContentType,
  parseBoolean,
  parsePositiveInt,
  resolveS3Credentials,
  sanitizePathSegment,
  validateTaskAssetUploadInput,
} from "../../../apps/api/src/storage/s3";

describe("S3 helpers", () => {
  const originalMaxSize = process.env.S3_MAX_IMAGE_UPLOAD_BYTES;
  const originalEndpoint = process.env.S3_ENDPOINT;
  const originalBucket = process.env.S3_BUCKET;
  const originalAccessKeyId = process.env.S3_ACCESS_KEY_ID;
  const originalSecretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const originalRegion = process.env.S3_REGION;
  const originalPathStyle = process.env.S3_FORCE_PATH_STYLE;
  const originalKeyPrefix = process.env.S3_KEY_PREFIX;

  beforeEach(() => {
    delete process.env.S3_MAX_IMAGE_UPLOAD_BYTES;
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalMaxSize === undefined) {
      delete process.env.S3_MAX_IMAGE_UPLOAD_BYTES;
    } else {
      process.env.S3_MAX_IMAGE_UPLOAD_BYTES = originalMaxSize;
    }

    if (originalEndpoint === undefined) {
      delete process.env.S3_ENDPOINT;
    } else {
      process.env.S3_ENDPOINT = originalEndpoint;
    }

    if (originalBucket === undefined) {
      delete process.env.S3_BUCKET;
    } else {
      process.env.S3_BUCKET = originalBucket;
    }

    if (originalAccessKeyId === undefined) {
      delete process.env.S3_ACCESS_KEY_ID;
    } else {
      process.env.S3_ACCESS_KEY_ID = originalAccessKeyId;
    }

    if (originalSecretAccessKey === undefined) {
      delete process.env.S3_SECRET_ACCESS_KEY;
    } else {
      process.env.S3_SECRET_ACCESS_KEY = originalSecretAccessKey;
    }

    if (originalRegion === undefined) {
      delete process.env.S3_REGION;
    } else {
      process.env.S3_REGION = originalRegion;
    }

    if (originalPathStyle === undefined) {
      delete process.env.S3_FORCE_PATH_STYLE;
    } else {
      process.env.S3_FORCE_PATH_STYLE = originalPathStyle;
    }

    if (originalKeyPrefix === undefined) {
      delete process.env.S3_KEY_PREFIX;
    } else {
      process.env.S3_KEY_PREFIX = originalKeyPrefix;
    }
  });

  it("recognizes allowed image content types case-insensitively", () => {
    expect(isImageContentType("IMAGE/PNG")).toBe(true);
    expect(isImageContentType("text/plain")).toBe(false);
  });

  it("parses booleans and positive integers with fallbacks", () => {
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parseBoolean(" false ", true)).toBe(false);
    expect(parsePositiveInt("42", 10)).toBe(42);
    expect(parsePositiveInt("0", 10)).toBe(10);
    expect(parsePositiveInt("nope", 10)).toBe(10);
  });

  it("sanitizes path segments and extracts normalized extensions", () => {
    expect(sanitizePathSegment(" Release Notes!!.PNG ")).toBe(
      "release-notes-.png",
    );
    expect(sanitizePathSegment("")).toBe("file");
    expect(getFileExtension("Screenshot.Final.PNG")).toBe("png");
    expect(getFileExtension("README")).toBe("file");
  });

  it("builds stable key prefixes and keys", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_717_171_717_000);

    const key = buildObjectKey({
      workspaceId: "Workspace 1",
      projectId: "Project 2",
      taskId: "Task 3",
      surface: "comment",
      filename: "Sprint Plan Final!!.PNG",
      contentType: "image/png",
    });

    expect(
      buildObjectKeyPrefix({
        workspaceId: "Workspace 1",
        projectId: "Project 2",
        taskId: "Task 3",
        surface: "comment",
      }),
    ).toBe("workspace/workspace-1/project/project-2/task/task-3/comments");

    expect(key).toMatch(
      /^workspace\/workspace-1\/project\/project-2\/task\/task-3\/comments\/sprint-plan-final-1717171717000-[a-z0-9]+\.png$/,
    );
    process.env.S3_ENDPOINT = "https://storage.example.test";
    process.env.S3_BUCKET = "kaneo";
    process.env.S3_ACCESS_KEY_ID = "test-access-key";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
    delete process.env.S3_KEY_PREFIX;

    expect(
      assertTaskImageKeyMatchesContext(key, {
        workspaceId: "Workspace 1",
        projectId: "Project 2",
        taskId: "Task 3",
        surface: "comment",
      }),
    ).toBe(true);
  });

  it("applyKeyPrefix prepends prefix and trims trailing slashes", () => {
    expect(applyKeyPrefix("", "workspace/a/file.png")).toBe(
      "workspace/a/file.png",
    );
    expect(applyKeyPrefix("staging", "workspace/a/file.png")).toBe(
      "staging/workspace/a/file.png",
    );
    expect(applyKeyPrefix("prod/kaneo/", "workspace/a/file.png")).toBe(
      "prod/kaneo/workspace/a/file.png",
    );
    expect(applyKeyPrefix("prefix///", "key")).toBe("prefix/key");
  });

  it("assertTaskImageKeyMatchesContext respects S3_KEY_PREFIX", () => {
    process.env.S3_ENDPOINT = "https://storage.example.test";
    process.env.S3_BUCKET = "kaneo";
    process.env.S3_ACCESS_KEY_ID = "test-access-key";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.S3_KEY_PREFIX = "staging";

    const ctx = {
      workspaceId: "ws1",
      projectId: "p1",
      taskId: "t1",
      surface: "description" as const,
    };

    const prefixedKey =
      "staging/workspace/ws1/project/p1/task/t1/descriptions/img-123-abc.png";
    const unprefixedKey =
      "workspace/ws1/project/p1/task/t1/descriptions/img-123-abc.png";

    expect(assertTaskImageKeyMatchesContext(prefixedKey, ctx)).toBe(true);
    expect(assertTaskImageKeyMatchesContext(unprefixedKey, ctx)).toBe(false);
  });

  it("validates upload size against the configured maximum", () => {
    process.env.S3_MAX_IMAGE_UPLOAD_BYTES = "1048576";

    expect(() => validateTaskAssetUploadInput("", 10)).toThrow(
      "A valid content type is required.",
    );
    expect(() => validateTaskAssetUploadInput("image/png", 0)).toThrow(
      "Upload size must be greater than zero.",
    );
    expect(() =>
      validateTaskAssetUploadInput("image/png", 2 * 1024 * 1024),
    ).toThrow("Upload exceeds the maximum upload size of 1MB.");
    expect(() => validateTaskAssetUploadInput("image/png", 512)).not.toThrow();
  });

  it("creates presigned upload URLs without hoisted checksum query params", async () => {
    process.env.S3_ENDPOINT = "https://storage.example.test";
    process.env.S3_BUCKET = "kaneo";
    process.env.S3_ACCESS_KEY_ID = "test-access-key";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.S3_REGION = "us-east-1";
    process.env.S3_FORCE_PATH_STYLE = "true";
    delete process.env.S3_KEY_PREFIX;

    const upload = await createTaskImageUploadUrl({
      workspaceId: "workspace-1",
      projectId: "project-1",
      taskId: "task-1",
      surface: "description",
      filename: "report.png",
      contentType: "image/png",
    });

    const searchParams = new URL(upload.uploadUrl).searchParams;
    expect(searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(false);
  });

  it("resolveS3Credentials returns explicit credentials when both keys are set", () => {
    expect(resolveS3Credentials("AKIA", "secret")).toEqual({
      accessKeyId: "AKIA",
      secretAccessKey: "secret",
    });
  });

  it("resolveS3Credentials returns undefined when both keys are absent (IAM role fallback)", () => {
    expect(resolveS3Credentials("", "")).toBeUndefined();
  });

  it("resolveS3Credentials throws when only one key is set", () => {
    expect(() => resolveS3Credentials("AKIA", "")).toThrow(
      /both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY/,
    );
    expect(() => resolveS3Credentials("", "secret")).toThrow(
      /both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY/,
    );
  });

  it("assertStorageConfigured succeeds without static keys (IAM role mode)", () => {
    process.env.S3_ENDPOINT = "https://s3.us-east-1.amazonaws.com";
    process.env.S3_BUCKET = "kaneo";
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;

    const config = assertStorageConfigured();
    expect(config.bucket).toBe("kaneo");
    expect(config.accessKeyId).toBe("");
    expect(config.secretAccessKey).toBe("");
  });

  it("assertStorageConfigured throws when only one credential key is set", () => {
    process.env.S3_ENDPOINT = "https://s3.us-east-1.amazonaws.com";
    process.env.S3_BUCKET = "kaneo";
    process.env.S3_ACCESS_KEY_ID = "AKIA";
    delete process.env.S3_SECRET_ACCESS_KEY;

    expect(() => assertStorageConfigured()).toThrow(
      /Incomplete S3 credentials/,
    );
  });

  it("assertStorageConfigured throws when endpoint or bucket is missing", () => {
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;

    expect(() => assertStorageConfigured()).toThrow(
      /S3 uploads are not configured/,
    );
  });
});

describe("S3 credential provider chain (IAM role)", () => {
  const trackedKeys = [
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_REGION",
    "S3_FORCE_PATH_STYLE",
    "S3_KEY_PREFIX",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
  ] as const;

  const original: Partial<Record<(typeof trackedKeys)[number], string>> = {};

  beforeEach(() => {
    for (const key of trackedKeys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of trackedKeys) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("signs presigned URLs using ambient credentials when S3 keys are unset", async () => {
    // Non-sensitive, obviously-fake credentials generated at runtime so no
    // credential-like literals are committed (avoids secret-scanning hits).
    const ambientAccessKeyId = `test-ambient-key-${Date.now()}`;
    const ambientSecretAccessKey = `test-ambient-secret-${Date.now()}`;

    // Simulates an IAM role / IRSA / instance profile: no S3_ACCESS_KEY_ID is
    // configured, but ambient AWS credentials are resolvable from the
    // environment (the AWS SDK default provider chain reads AWS_* env vars).
    process.env.S3_ENDPOINT = "https://s3.us-east-1.amazonaws.com";
    process.env.S3_BUCKET = "kaneo";
    process.env.S3_REGION = "us-east-1";
    process.env.S3_FORCE_PATH_STYLE = "false";
    process.env.AWS_ACCESS_KEY_ID = ambientAccessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = ambientSecretAccessKey;

    const upload = await createTaskImageUploadUrl({
      workspaceId: "workspace-1",
      projectId: "project-1",
      taskId: "task-1",
      surface: "description",
      filename: "report.png",
      contentType: "image/png",
    });

    const searchParams = new URL(upload.uploadUrl).searchParams;
    // The signature must be derived from the ambient credentials, proving the
    // SDK default provider chain (used for IAM roles) was applied.
    expect(searchParams.get("X-Amz-Credential")).toContain(ambientAccessKeyId);
    expect(searchParams.has("X-Amz-Signature")).toBe(true);
  });
});

vi.mock("../../../apps/api/src/database", () => ({ default: {} }));

const { contentReferencesAsset, extractAssetIds } = await import(
  "../../../apps/api/src/storage/cleanup-assets"
);

describe("extractAssetIds", () => {
  it("extracts asset IDs from content with /api/asset/ URLs", () => {
    const content =
      '<p>Hello <img src="http://localhost:1337/api/asset/abc123" /> world <img src="/api/asset/def456" /></p>';
    const ids = extractAssetIds(content);
    expect(ids).toEqual(new Set(["abc123", "def456"]));
  });

  it("returns empty set for null/undefined/empty content", () => {
    expect(extractAssetIds(null)).toEqual(new Set());
    expect(extractAssetIds(undefined)).toEqual(new Set());
    expect(extractAssetIds("")).toEqual(new Set());
  });

  it("returns empty set when no asset URLs are present", () => {
    expect(extractAssetIds("<p>No images here</p>")).toEqual(new Set());
  });

  it("deduplicates repeated asset IDs", () => {
    const content = "/api/asset/abc123 and again /api/asset/abc123";
    expect(extractAssetIds(content)).toEqual(new Set(["abc123"]));
  });

  it("does not treat asset ID prefixes as references", () => {
    expect(contentReferencesAsset("/api/asset/abc123xyz", "abc123")).toBe(
      false,
    );
    expect(contentReferencesAsset("/api/asset/abc123", "abc123")).toBe(true);
  });
});
