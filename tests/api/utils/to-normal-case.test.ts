import { describe, expect, it } from "vitest";
import toNormalCase from "../../../apps/api/src/utils/to-normal-case";

describe("toNormalCase", () => {
  it("normalizes kebab and snake case", () => {
    expect(toNormalCase("in-progress")).toBe("In Progress");
    expect(toNormalCase("custom_oauth_status")).toBe("Custom Oauth Status");
  });

  it("returns falsy input as-is", () => {
    expect(toNormalCase(undefined)).toBeUndefined();
    expect(toNormalCase("")).toBe("");
  });
});
