import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import type { FieldJson } from "./field-json.js";
import {
  renderFieldChange,
  renderFieldValueChange,
} from "./render-field-change.js";
import { renderFieldList } from "./render-field-list.js";
import { renderTaskFields } from "./render-task-fields.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const points: FieldJson = {
  id: "f_points",
  name: "Story points",
  type: "number",
  required: false,
  defaultValue: null,
  options: [],
};

const platform: FieldJson = {
  id: "f_platform",
  name: "Platform",
  type: "multiselect",
  required: true,
  defaultValue: null,
  options: ["iOS", "Android", "Web"],
};

describe("renderFieldList", () => {
  it("shows name, type, options and required in 80 columns", () => {
    const lines = renderFieldList(ui, {
      projectName: "Kaneo Web",
      fields: [points, platform],
    });
    expect(lines).toEqual([
      "",
      "  Story points  Number",
      "  Platform      Multi-select  iOS, Android, Web  required",
      "",
    ]);
  });

  it("shortens long option lists instead of wrapping", () => {
    const lines = renderFieldList(ui, {
      projectName: "Kaneo Web",
      fields: [
        {
          ...platform,
          options: Array.from({ length: 20 }, (_, index) => `Option ${index}`),
        },
      ],
    });
    expect(lines[1]).toContain("…");
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("explains how to add the first field", () => {
    expect(
      renderFieldList(ui, { projectName: "Kaneo Web", fields: [] }),
    ).toEqual([
      "",
      "  No custom fields in Kaneo Web yet.",
      "  Add one with kaneo field create <name> --type text.",
      "",
    ]);
  });
});

describe("renderTaskFields", () => {
  it("lists every field with its value or not set", () => {
    expect(
      renderTaskFields(ui, {
        label: "KAN-12",
        title: "Fix login redirect",
        url: "http://localhost:5173/task",
        fields: [
          { id: "f_points", name: "Story points", type: "number", value: 5 },
          {
            id: "f_platform",
            name: "Platform",
            type: "multiselect",
            value: null,
          },
          { id: "f_flag", name: "Blocked", type: "boolean", value: false },
        ],
      }),
    ).toEqual([
      "",
      "  KAN-12 · Fix login redirect",
      "",
      "    Story points  5",
      "    Platform      not set",
      "    Blocked       No",
      "",
    ]);
  });

  it("truncates a long title to 80 columns", () => {
    const lines = renderTaskFields(ui, {
      label: "KAN-12",
      title: "T".repeat(120),
      url: "http://localhost:5173/task",
      fields: [],
    });
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
    expect(lines[3]).toBe("    This project has no custom fields.");
  });
});

describe("field change lines", () => {
  it("confirms create and delete", () => {
    expect(
      renderFieldChange(ui, {
        verb: "Created",
        name: "Platform",
        type: "multiselect",
      }),
    ).toEqual(["", "  ✓ Created the field Platform · Multi-select", ""]);
    expect(
      renderFieldChange(ui, {
        verb: "Deleted",
        name: "Platform",
        type: "multiselect",
      }),
    ).toEqual([
      "",
      "  ✓ Deleted the field Platform · its values are gone from every task",
      "",
    ]);
  });

  it("confirms setting and clearing a value", () => {
    const base = { label: "KAN-12", url: "http://x", field: "Story points" };
    expect(renderFieldValueChange(ui, { ...base, value: "5" })).toEqual([
      "",
      "  ✓ KAN-12 · Story points set to 5",
      "",
    ]);
    expect(renderFieldValueChange(ui, { ...base, value: null })).toEqual([
      "",
      "  ✓ KAN-12 · Story points cleared",
      "",
    ]);
  });
});
