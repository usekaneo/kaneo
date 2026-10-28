import { describe, expect, it } from "vite-plus/test";
import { resolveImageTarget } from "./image-target.js";

const tty = { isTTY: true, columns: 80 };

describe("resolveImageTarget", () => {
  it("wraps forced graphics in tmux passthrough", () => {
    const target = resolveImageTarget(
      { KANEO_IMAGES: "kitty", TMUX: "/tmp/tmux" },
      tty,
      { json: false, color: 3, unicode: true },
    );
    expect(target).toMatchObject({ protocol: "kitty", tmux: true });
  });

  it("does not wrap blocks, which are plain text", () => {
    const target = resolveImageTarget({ TMUX: "/tmp/tmux" }, tty, {
      json: false,
      color: 3,
      unicode: true,
    });
    expect(target).toMatchObject({ protocol: "blocks", tmux: false });
  });

  it("uses 256 colors only when that is all the terminal has", () => {
    const at = (color: 0 | 1 | 2 | 3) =>
      resolveImageTarget({ KANEO_IMAGES: "blocks" }, tty, {
        json: false,
        color,
        unicode: true,
      }).level;
    expect(at(2)).toBe(2);
    expect(at(3)).toBe(3);
    expect(at(0)).toBe(3);
  });

  it("reads the terminal background from COLORFGBG", () => {
    const target = resolveImageTarget({ COLORFGBG: "0;15" }, tty, {
      json: false,
      color: 3,
      unicode: true,
    });
    expect(target.background).toEqual([255, 255, 255]);
    expect(
      resolveImageTarget({}, tty, { json: false, color: 3, unicode: true })
        .background,
    ).toBeNull();
  });
});
