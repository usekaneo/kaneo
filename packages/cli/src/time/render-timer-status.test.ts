import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderTimerStatus } from "./render-timer-status.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderTimerStatus", () => {
  it("shows the running timer with elapsed time and note", () => {
    const startedAt = new Date(2026, 9, 8, 9, 5).toISOString();
    expect(
      renderTimerStatus(ui, {
        label: "KAN-12",
        url: "https://kaneo.test/t",
        title: "Fix login redirect",
        startedAt,
        elapsedSeconds: 5100,
        note: "Pairing",
      }),
    ).toEqual([
      "",
      "  ● KAN-12 · Fix login redirect",
      "    1h 25m since 09:05 · Pairing",
      "",
    ]);
  });

  it("says when nothing is running", () => {
    expect(renderTimerStatus(ui, null)).toEqual([
      "",
      "  ● No timer running",
      "",
      "  Start one with kaneo time start <task>",
      "",
    ]);
  });
});
