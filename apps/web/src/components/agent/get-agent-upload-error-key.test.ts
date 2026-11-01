import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { getAgentUploadErrorKey } from "./get-agent-upload-error-key";

describe("getAgentUploadErrorKey", () => {
  it("maps upload rejections to attachment copy", () => {
    expect(getAgentUploadErrorKey(new HttpError(413, ""))).toBe(
      "agent:composer.attachmentErrors.fileTooLarge",
    );
    expect(getAgentUploadErrorKey(new HttpError(400, ""))).toBe(
      "agent:composer.attachmentErrors.unreadable",
    );
    expect(getAgentUploadErrorKey(new HttpError(429, ""))).toBe(
      "agent:composer.attachmentErrors.tooManyPending",
    );
  });

  it("reuses agent copy for availability and falls back to a generic upload error", () => {
    expect(getAgentUploadErrorKey(new HttpError(503, ""))).toBe(
      "agent:errors.unavailable",
    );
    expect(getAgentUploadErrorKey(new Error("Failed to fetch"))).toBe(
      "agent:composer.attachmentErrors.uploadFailed",
    );
  });
});
