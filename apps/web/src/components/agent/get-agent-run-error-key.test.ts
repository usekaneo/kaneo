import { describe, expect, it } from "vite-plus/test";
import { getAgentRunErrorKey } from "./get-agent-run-error-key";

describe("getAgentRunErrorKey", () => {
  it("translates the API's unsupported attachment error", () => {
    expect(
      getAgentRunErrorKey(
        "The model cannot read these attachments; remove them or use a model with image input",
      ),
    ).toBe("agent:errors.unsupportedAttachments");
  });

  it("leaves other run errors as stored", () => {
    expect(getAgentRunErrorKey("Run cancelled")).toBeNull();
    expect(getAgentRunErrorKey(null)).toBeNull();
  });
});
