import { describe, expect, it } from "vite-plus/test";
import { encodeIterm } from "./iterm.js";

describe("encodeIterm", () => {
  it("sends the original bytes with the size in cells", () => {
    expect(
      encodeIterm(
        new Uint8Array([1, 2, 3, 4]),
        { columns: 12, rows: 6 },
        {
          tmux: false,
        },
      ),
    ).toBe(
      "\u001b]1337;File=inline=1;width=12;height=6;preserveAspectRatio=1;size=4:AQIDBA==\u0007",
    );
  });

  it("wraps the sequence in tmux passthrough", () => {
    const output = encodeIterm(
      new Uint8Array([1]),
      { columns: 1, rows: 1 },
      {
        tmux: true,
      },
    );
    expect(output.startsWith("\u001bPtmux;\u001b\u001b]1337;File=")).toBe(true);
    expect(output.endsWith("\u0007\u001b\\")).toBe(true);
  });
});
