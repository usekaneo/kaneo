import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderNotificationsRead } from "./render-notifications-read.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderNotificationsRead", () => {
  it("counts the notifications it marked", () => {
    expect(renderNotificationsRead(ui, { all: false, count: 1 })).toEqual([
      "",
      "  ✓ Marked 1 notification read",
      "",
    ]);
    expect(renderNotificationsRead(ui, { all: false, count: 3 })[1]).toBe(
      "  ✓ Marked 3 notifications read",
    );
  });

  it("covers marking everything", () => {
    expect(renderNotificationsRead(ui, { all: true, count: 0 })[1]).toBe(
      "  ✓ Marked all notifications read",
    );
  });
});
