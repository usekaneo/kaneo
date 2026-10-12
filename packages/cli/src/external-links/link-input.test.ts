import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { validateLinkTitle, validateLinkUrl } from "./link-input.js";

describe("validateLinkUrl", () => {
  it("accepts http and https addresses", () => {
    expect(Result.getOrThrow(validateLinkUrl(" https://example.com/a "))).toBe(
      "https://example.com/a",
    );
    expect(Result.isSuccess(validateLinkUrl("http://localhost:3000"))).toBe(
      true,
    );
  });

  it("rejects other schemes and plain words", () => {
    const ftp = validateLinkUrl("ftp://example.com");
    expect(Result.isFailure(ftp) && ftp.failure.message).toBe(
      "Links must use http or https, not ftp.",
    );
    expect(Result.isFailure(validateLinkUrl("example"))).toBe(true);
  });
});

describe("validateLinkTitle", () => {
  it("drops an empty title and limits the length", () => {
    expect(Result.getOrThrow(validateLinkTitle("  "))).toBeUndefined();
    expect(Result.getOrThrow(validateLinkTitle(" Spec "))).toBe("Spec");
    expect(Result.isFailure(validateLinkTitle("x".repeat(201)))).toBe(true);
  });
});
