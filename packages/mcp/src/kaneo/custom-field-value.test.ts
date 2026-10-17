import { describe, expect, it } from "vite-plus/test";
import { encodeCustomFieldValue } from "./custom-field-value.js";

describe("encodeCustomFieldValue", () => {
  it("encodes multiselect options as a JSON array string", () => {
    expect(encodeCustomFieldValue(["Frontend", "API"])).toBe(
      '["Frontend","API"]',
    );
  });

  it("clears the value for null or an empty selection", () => {
    expect(encodeCustomFieldValue(null)).toBe("");
    expect(encodeCustomFieldValue([])).toBe("");
  });

  it("stringifies numbers and booleans", () => {
    expect(encodeCustomFieldValue(3.5)).toBe("3.5");
    expect(encodeCustomFieldValue(false)).toBe("false");
    expect(encodeCustomFieldValue("2026-10-17")).toBe("2026-10-17");
  });
});
