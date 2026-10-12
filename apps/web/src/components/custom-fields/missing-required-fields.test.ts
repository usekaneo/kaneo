import { describe, expect, it } from "vite-plus/test";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import {
  findMissingRequiredFields,
  isCustomFieldValueEmpty,
} from "./missing-required-fields";

const field = (
  id: string,
  type: CustomFieldDefinition["type"],
  required = true,
): CustomFieldDefinition => ({
  id,
  projectId: "p",
  name: id,
  type,
  required,
  defaultValue: null,
  options: null,
  position: 0,
  createdAt: "",
  updatedAt: "",
});

describe("isCustomFieldValueEmpty", () => {
  it("treats blank text and empty multiselect arrays as empty", () => {
    expect(isCustomFieldValueEmpty("text", "  ")).toBe(true);
    expect(isCustomFieldValueEmpty("multiselect", "[]")).toBe(true);
    expect(isCustomFieldValueEmpty("multiselect", '["Web"]')).toBe(false);
  });
});

describe("findMissingRequiredFields", () => {
  it("returns required fields without a value, in order", () => {
    const fields = [
      field("customer", "text"),
      field("points", "number"),
      field("notes", "text", false),
      field("platforms", "multiselect"),
    ];
    const missing = findMissingRequiredFields(fields, {
      customer: "",
      points: "5",
      notes: "",
      platforms: "[]",
    });
    expect(missing.map((f) => f.id)).toEqual(["customer", "platforms"]);
  });

  it("never flags booleans because off is a valid value", () => {
    expect(
      findMissingRequiredFields([field("billable", "boolean")], {
        billable: "",
      }),
    ).toEqual([]);
  });
});
