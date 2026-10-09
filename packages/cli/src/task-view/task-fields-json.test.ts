import { describe, expect, it } from "vite-plus/test";
import type { TaskFieldValue } from "./task-field-values.js";
import { toTaskFieldsJson } from "./task-fields-json.js";

const value = (
  fieldId: string,
  fieldName: string,
  fieldType: string,
  raw: string | null,
  fieldPosition: number,
): TaskFieldValue => ({
  fieldId,
  fieldName,
  fieldType,
  value: raw,
  fieldPosition,
});

describe("toTaskFieldsJson", () => {
  it("orders fields like the project, parses values and drops empty ones", () => {
    expect(
      toTaskFieldsJson([
        value("f3", "Shipped", "boolean", "true", 2),
        value("f1", "Points", "number", "3", 0),
        value("f4", "Platforms", "multiselect", "[]", 3),
        value("f2", "Customer", "text", "  ", 1),
        value("f5", "Due in", "date", null, 4),
      ]),
    ).toEqual([
      { id: "f1", name: "Points", type: "number", value: 3 },
      { id: "f3", name: "Shipped", type: "boolean", value: true },
    ]);
  });
});
