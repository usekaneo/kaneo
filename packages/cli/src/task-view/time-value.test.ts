import { describe, expect, it } from "vite-plus/test";
import { renderCell } from "../render/cell.js";
import { makeUi } from "../render/ui.js";
import { hasTrackedTime, timeValue } from "./time-value.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const timer = (name: string | null) => ({
  user: name ? { id: name, name } : null,
  startedAt: "2026-10-07T11:00:00.000Z",
});

describe("timeValue", () => {
  it("shows the total on its own when nothing is running", () => {
    expect(
      renderCell(timeValue(ui, { totalSeconds: 5400, running: [] }), ui),
    ).toBe("1h 30m");
  });

  it("names everyone with a running timer once", () => {
    expect(
      renderCell(
        timeValue(ui, {
          totalSeconds: 600,
          running: [timer("Ada"), timer("Grace"), timer("Ada"), timer(null)],
        }),
        ui,
      ),
    ).toBe("10m · ● Timer running (Ada, Grace, someone)");
  });
});

describe("hasTrackedTime", () => {
  it("is true with logged time or a timer that just started", () => {
    expect(hasTrackedTime({ totalSeconds: 0, running: [] })).toBe(false);
    expect(hasTrackedTime({ totalSeconds: 60, running: [] })).toBe(true);
    expect(hasTrackedTime({ totalSeconds: 0, running: [timer("Ada")] })).toBe(
      true,
    );
  });
});
