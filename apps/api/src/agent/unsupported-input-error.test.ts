import { APICallError } from "ai";
import { UnsupportedFunctionalityError } from "@ai-sdk/provider";
import { describe, expect, it } from "vite-plus/test";
import {
  isUnsupportedInputError,
  UNSUPPORTED_ATTACHMENTS_ERROR,
} from "./unsupported-input-error";

const apiError = (statusCode: number, message: string, responseBody = "") =>
  new APICallError({
    message,
    url: "https://openrouter.ai/api/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    responseBody,
  });

describe("isUnsupportedInputError", () => {
  it("recognizes providers rejecting image or file input", () => {
    expect(
      isUnsupportedInputError(
        apiError(404, "No endpoints found that support image input"),
      ),
    ).toBe(true);
    expect(
      isUnsupportedInputError(
        apiError(
          400,
          "Bad request",
          '{"error":{"message":"This model does not support image inputs"}}',
        ),
      ),
    ).toBe(true);
  });

  it("ignores other provider failures", () => {
    expect(isUnsupportedInputError(apiError(404, "Model not found"))).toBe(
      false,
    );
    expect(
      isUnsupportedInputError(
        apiError(500, "No endpoints support image input"),
      ),
    ).toBe(false);
    expect(isUnsupportedInputError(new Error("image input"))).toBe(false);
  });

  it("recognizes direct SDK adapters rejecting file input before an API call", () => {
    expect(
      isUnsupportedInputError(
        new UnsupportedFunctionalityError({
          functionality: "file part media type application/pdf",
        }),
      ),
    ).toBe(true);
    expect(
      isUnsupportedInputError(
        new UnsupportedFunctionalityError({
          functionality: "tool-call messages",
        }),
      ),
    ).toBe(false);
  });

  it("keeps the stored text that the web client translates", () => {
    // apps/web/src/components/agent/get-agent-run-error-key.ts matches it.
    expect(UNSUPPORTED_ATTACHMENTS_ERROR).toBe(
      "The model cannot read these attachments; remove them or use a model with image input",
    );
  });
});
