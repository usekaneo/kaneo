import { describe, expect, it } from "vite-plus/test";
import { isDeleteConfirmationValid } from "./is-delete-confirmation-valid";

describe("isDeleteConfirmationValid", () => {
  it("matches the email ignoring case and surrounding spaces", () => {
    expect(
      isDeleteConfirmationValid("  Jo@Example.com ", "jo@example.com"),
    ).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isDeleteConfirmationValid("jo@example", "jo@example.com")).toBe(
      false,
    );
    expect(isDeleteConfirmationValid("", "")).toBe(false);
    expect(isDeleteConfirmationValid("x", undefined)).toBe(false);
  });
});
