import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertTaskImageKeyMatchesContext,
  buildObjectKey,
  buildObjectKeyPrefix,
  getFileExtension,
  isImageContentType,
  parseBoolean,
  parsePositiveInt,
  sanitizePathSegment,
  validateTaskAssetUploadInput,
} from "../../../apps/api/src/storage/s3";

describe("S3 helpers", () => {
  const originalMaxSize = process.env.S3_MAX_IMAGE_UPLOAD_BYTES;

  beforeEach(() => {
    delete process.env.S3_MAX_IMAGE_UPLOAD_BYTES;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalMaxSize === undefined) {
      delete process.env.S3_MAX_IMAGE_UPLOAD_BYTES;
      return;
    }

    process.env.S3_MAX_IMAGE_UPLOAD_BYTES = originalMaxSize;
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
    expect(
      assertTaskImageKeyMatchesContext(key, {
        workspaceId: "Workspace 1",
        projectId: "Project 2",
        taskId: "Task 3",
        surface: "comment",
      }),
    ).toBe(true);
  });

  it("validates upload size against the configured maximum", () => {
    process.env.S3_MAX_IMAGE_UPLOAD_BYTES = "1048576";

    expect(() => validateTaskAssetUploadInput("", 10)).toThrow(
      "A valid content type is required.",
    );
    expect(() => validateTaskAssetUploadInput("image/png", 0)).toThrow(
      "Upload size must be greater than zero.",
    );
    expect(() => validateTaskAssetUploadInput("image/png", 2048)).toThrow(
      "Upload exceeds the maximum upload size of 1MB.",
    );
    expect(() => validateTaskAssetUploadInput("image/png", 512)).not.toThrow();
  });
});
