import { describe, expect, it } from "vite-plus/test";
import { detectImageProtocol, type ImageContext } from "./image-protocol.js";

const tty = { isTTY: true, columns: 100 };
const piped = { isTTY: false, columns: undefined };
const truecolor: ImageContext = { json: false, color: 3, unicode: true };

describe("detectImageProtocol", () => {
  it("uses the kitty graphics protocol in kitty and Ghostty", () => {
    expect(detectImageProtocol({ TERM: "xterm-kitty" }, tty, truecolor)).toBe(
      "kitty",
    );
    expect(detectImageProtocol({ KITTY_WINDOW_ID: "1" }, tty, truecolor)).toBe(
      "kitty",
    );
    expect(
      detectImageProtocol({ TERM_PROGRAM: "ghostty" }, tty, truecolor),
    ).toBe("kitty");
    expect(detectImageProtocol({ TERM: "xterm-ghostty" }, tty, truecolor)).toBe(
      "kitty",
    );
  });

  it("uses iTerm2 inline images in iTerm2 and WezTerm", () => {
    expect(
      detectImageProtocol({ TERM_PROGRAM: "iTerm.app" }, tty, truecolor),
    ).toBe("iterm");
    expect(detectImageProtocol({ LC_TERMINAL: "iTerm2" }, tty, truecolor)).toBe(
      "iterm",
    );
    expect(
      detectImageProtocol({ TERM_PROGRAM: "WezTerm" }, tty, truecolor),
    ).toBe("iterm");
  });

  it("draws blocks in the VS Code terminal, where inline images are opt-in", () => {
    expect(
      detectImageProtocol(
        { TERM_PROGRAM: "vscode", TERM_PROGRAM_VERSION: "1.99.0" },
        tty,
        truecolor,
      ),
    ).toBe("blocks");
  });

  it("falls back to blocks with 256 colors and to none with fewer", () => {
    const env = { TERM: "xterm-256color" };
    expect(detectImageProtocol(env, tty, { ...truecolor, color: 2 })).toBe(
      "blocks",
    );
    expect(detectImageProtocol(env, tty, { ...truecolor, color: 1 })).toBe(
      "none",
    );
    expect(
      detectImageProtocol(env, tty, { ...truecolor, unicode: false }),
    ).toBe("none");
  });

  it("prefers blocks inside tmux, even in kitty", () => {
    expect(
      detectImageProtocol(
        { TMUX: "/tmp/tmux-501/default,1,0", TERM: "xterm-kitty" },
        tty,
        truecolor,
      ),
    ).toBe("blocks");
    expect(
      detectImageProtocol({ TMUX: "/tmp/tmux", LC_TERMINAL: "iTerm2" }, tty, {
        ...truecolor,
        color: 1,
      }),
    ).toBe("none");
  });

  it("shows nothing for JSON, pipes, dumb terminals and KANEO_IMAGES=off", () => {
    const env = { TERM_PROGRAM: "iTerm.app" };
    expect(detectImageProtocol(env, tty, { ...truecolor, json: true })).toBe(
      "none",
    );
    expect(detectImageProtocol(env, piped, truecolor)).toBe("none");
    expect(detectImageProtocol({ ...env, TERM: "dumb" }, tty, truecolor)).toBe(
      "none",
    );
    for (const value of ["off", "0", "false", "OFF"]) {
      expect(
        detectImageProtocol({ ...env, KANEO_IMAGES: value }, tty, truecolor),
      ).toBe("none");
    }
  });

  it("lets KANEO_IMAGES force a protocol, except in JSON mode", () => {
    expect(
      detectImageProtocol(
        { KANEO_IMAGES: "kitty", TMUX: "/tmp/tmux" },
        tty,
        truecolor,
      ),
    ).toBe("kitty");
    expect(
      detectImageProtocol({ KANEO_IMAGES: "iterm" }, piped, truecolor),
    ).toBe("iterm");
    expect(
      detectImageProtocol({ KANEO_IMAGES: "blocks", TERM: "dumb" }, tty, {
        ...truecolor,
        color: 0,
      }),
    ).toBe("blocks");
    expect(
      detectImageProtocol({ KANEO_IMAGES: "kitty" }, tty, {
        ...truecolor,
        json: true,
      }),
    ).toBe("none");
    expect(
      detectImageProtocol(
        { KANEO_IMAGES: "sixel", TERM_PROGRAM: "WezTerm" },
        tty,
        truecolor,
      ),
    ).toBe("iterm");
  });
});
