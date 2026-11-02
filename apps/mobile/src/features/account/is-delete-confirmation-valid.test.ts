import { describe, expect, it } from "vite-plus/test";

import { isDeleteConfirmationValid } from "./is-delete-confirmation-valid";

describe("isDeleteConfirmationValid", () => {
  it("accepts the email ignoring case and surrounding spaces", () => {
    expect(
      isDeleteConfirmationValid("  Ada@Example.com ", "ada@example.com"),
    ).toBe(true);
  });

  it("rejects a different email", () => {
    expect(
      isDeleteConfirmationValid("ada@example.org", "ada@example.com"),
    ).toBe(false);
  });

  it("rejects when the email is unknown", () => {
    expect(isDeleteConfirmationValid("", undefined)).toBe(false);
    expect(isDeleteConfirmationValid("", "")).toBe(false);
  });
});
