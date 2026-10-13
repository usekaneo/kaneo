import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import {
  renderRelationLinked,
  renderRelationsRemoved,
} from "./render-relation-change.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const task = { label: "KAN-3", url: "https://kaneo.test/3" };
const other = { label: "KAN-4", url: "https://kaneo.test/4" };

describe("renderRelationLinked", () => {
  it("reads as a sentence from the first task", () => {
    expect(
      renderRelationLinked(ui(80), {
        type: "blocked-by",
        task,
        other: { ...other, title: "Session timeout" },
      }),
    ).toEqual(["", "  ✓ KAN-3 is now blocked by KAN-4 · Session timeout", ""]);
  });

  it("truncates the other title to the terminal width", () => {
    const [, line = ""] = renderRelationLinked(ui(80), {
      type: "subtask-of",
      task,
      other: { ...other, title: "B".repeat(100) },
    });
    expect(stringWidth(line)).toBe(80);
    expect(line.endsWith("…")).toBe(true);
  });
});

describe("renderRelationsRemoved", () => {
  it("describes a single removed relation", () => {
    expect(
      renderRelationsRemoved(ui(80), { types: ["parent-of"], task, other })[1],
    ).toBe("  ✓ KAN-3 is no longer the parent of KAN-4");
  });

  it("counts several removed relations", () => {
    expect(
      renderRelationsRemoved(ui(80), {
        types: ["blocks", "relates-to"],
        task,
        other,
      })[1],
    ).toBe("  ✓ Removed 2 relations between KAN-3 and KAN-4");
  });

  it("falls back for unknown types", () => {
    expect(
      renderRelationsRemoved(ui(80), { types: ["duplicates"], task, other })[1],
    ).toBe("  ✓ Unlinked KAN-3 and KAN-4");
  });
});
