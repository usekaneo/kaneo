import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderTimeEntries } from "./render-time-entries.js";
import type { TimeEntryJson } from "./time-entry-json.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const now = new Date(2026, 9, 8, 12, 0);

const entry = (
  id: string,
  day: number,
  seconds: number,
  options: { note?: string; running?: boolean } = {},
): TimeEntryJson => ({
  id,
  taskId: "t12",
  ticketId: "KAN-12",
  user: { id: "u1", name: "Ada Lovelace" },
  startedAt: new Date(2026, 9, day, 9, 0).toISOString(),
  endedAt: options.running ? null : new Date(2026, 9, day, 10, 0).toISOString(),
  durationSeconds: seconds,
  note: options.note ?? null,
  running: options.running ?? false,
});

const view = {
  label: "KAN-12",
  url: "https://kaneo.test/t12",
  title: "Fix login redirect",
  now,
  entries: [
    entry("a0b1c2d3e4f5g6h7i8j9k0l1", 6, 5400, {
      note: "Pairing on the device flow",
    }),
    entry("m2n3o4p5q6r7s8t9u0v1w2x3", 8, 1500, { running: true }),
  ],
};

describe("renderTimeEntries", () => {
  it("lists entries with a total at 80 columns", () => {
    expect(renderTimeEntries(ui(80), view)).toEqual([
      "",
      "  KAN-12 · Fix login redirect",
      "",
      "    Oct 6  1h 30m  Ada Lovelace  Pairing on the devic…  a0b1c2d3e4f5g6h7i8j9k0l1",
      "    Today   ● 25m  Ada Lovelace                         m2n3o4p5q6r7s8t9u0v1w2x3",
      "",
      "    Total 1h 55m · 2 entries",
      "",
    ]);
  });

  it("keeps every line within narrow terminals", () => {
    for (const line of renderTimeEntries(ui(60), view)) {
      expect(stringWidth(line)).toBeLessThanOrEqual(60);
    }
  });

  it("explains an empty list", () => {
    expect(renderTimeEntries(ui(80), { ...view, entries: [] })).toEqual([
      "",
      "  KAN-12 · Fix login redirect",
      "",
      "  No time logged yet.",
      "",
      "  Log some with kaneo time log KAN-12 1h",
      "",
    ]);
  });
});
