import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderDoctor } from "./render-doctor.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderDoctor", () => {
  it("prints one line per check and lists missing operations", () => {
    expect(
      renderDoctor(ui, {
        checks: [
          {
            name: "server",
            ok: true,
            detail: "localhost:1337 responded in 4 ms",
          },
          {
            name: "compatibility",
            ok: false,
            detail: "Missing 1 of 80 operations",
            missing: ["PUT /api/task/title/{id}"],
          },
        ],
      }),
    ).toEqual([
      "",
      "  ✓ Server             localhost:1337 responded in 4 ms",
      "  ✗ API compatibility  Missing 1 of 80 operations",
      "                       PUT /api/task/title/{id}",
      "",
      "  ✗ 1 of 2 checks failed",
      "",
    ]);
  });

  it("confirms when everything passes", () => {
    expect(
      renderDoctor(ui, {
        checks: [
          {
            name: "config",
            ok: true,
            detail: "/home/a/.config/kaneo/config.json",
          },
        ],
      }).at(-2),
    ).toBe("  ✓ Everything looks good");
  });
});
