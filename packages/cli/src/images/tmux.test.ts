import { describe, expect, it } from "vite-plus/test";
import { tmuxPassthrough } from "./tmux.js";

describe("tmuxPassthrough", () => {
  it("doubles every escape and wraps the sequence in a DCS", () => {
    expect(tmuxPassthrough("\u001b_Ga=T;AAAA\u001b\\")).toBe(
      "\u001bPtmux;\u001b\u001b_Ga=T;AAAA\u001b\u001b\\\u001b\\",
    );
  });

  it("leaves sequences that end with BEL intact apart from the escapes", () => {
    expect(tmuxPassthrough("\u001b]1337;File=:QQ==\u0007")).toBe(
      "\u001bPtmux;\u001b\u001b]1337;File=:QQ==\u0007\u001b\\",
    );
  });
});
