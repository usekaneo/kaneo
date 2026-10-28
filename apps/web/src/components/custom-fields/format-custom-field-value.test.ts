import { describe, expect, it } from "vite-plus/test";
import { formatCustomFieldValue } from "./format-custom-field-value";

describe("formatCustomFieldValue", () => {
  it("returns null for empty values and booleans", () => {
    expect(formatCustomFieldValue("text", " ", "short")).toBeNull();
    expect(formatCustomFieldValue("multiselect", "[]", "short")).toBeNull();
    expect(formatCustomFieldValue("boolean", "true", "short")).toBeNull();
  });

  it("shows two options and counts the rest", () => {
    expect(
      formatCustomFieldValue("multiselect", '["Web","iOS","Android"]', "short"),
    ).toEqual({ text: "Web, iOS", more: 1 });
  });

  it("formats dates as local calendar days", () => {
    expect(formatCustomFieldValue("date", "2026-10-22", "short")?.text).toMatch(
      /22/,
    );
    expect(
      formatCustomFieldValue("date", "2026-10-22", "medium")?.text,
    ).toMatch(/2026/);
  });

  it("keeps unparseable dates and plain values as typed", () => {
    expect(formatCustomFieldValue("date", "soon", "short")?.text).toBe("soon");
    expect(formatCustomFieldValue("number", "5", "short")).toEqual({
      text: "5",
      more: 0,
    });
  });
});
