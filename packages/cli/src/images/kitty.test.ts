import { describe, expect, it } from "vite-plus/test";
import { encodeKitty, KITTY_CHUNK } from "./kitty.js";

const ESC = "\u001b";
const size = { columns: 10, rows: 5 };
const COMMAND = new RegExp(`${ESC}_G([^;]*);([^${ESC}]*)${ESC}\\\\`, "gu");

function commands(output: string): Array<{ keys: string; data: string }> {
  return [...output.matchAll(COMMAND)].map((match) => ({
    keys: match[1] ?? "",
    data: match[2] ?? "",
  }));
}

describe("encodeKitty", () => {
  it("sends a small PNG in one command with the size in cells", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const output = encodeKitty({ format: "png", bytes }, size, { tmux: false });
    expect(output).toBe(`${ESC}_Ga=T,f=100,t=d,c=10,r=5,q=2,m=0;AQID${ESC}\\`);
  });

  it("splits the base64 payload into 4096 byte chunks", () => {
    const bytes = new Uint8Array(KITTY_CHUNK * 2);
    const output = encodeKitty({ format: "png", bytes }, size, { tmux: false });
    const parts = commands(output);
    expect(parts.map((part) => part.data.length)).toEqual([4096, 4096, 2732]);
    expect(parts[0]?.keys).toBe("a=T,f=100,t=d,c=10,r=5,q=2,m=1");
    expect(parts.slice(1, -1).every((part) => part.keys === "m=1,q=2")).toBe(
      true,
    );
    expect(parts[parts.length - 1]?.keys).toBe("m=0,q=2");
    expect(parts.map((part) => part.data).join("")).toBe(
      Buffer.from(bytes).toString("base64"),
    );
  });

  it("describes raw RGBA pixels and zlib compression", () => {
    const output = encodeKitty(
      {
        format: "rgba",
        width: 3,
        height: 2,
        bytes: new Uint8Array([9]),
        compressed: true,
      },
      size,
      { tmux: false },
    );
    expect(commands(output)[0]?.keys).toBe(
      "a=T,f=32,s=3,v=2,o=z,t=d,c=10,r=5,q=2,m=0",
    );
  });

  it("wraps every chunk in tmux passthrough", () => {
    const bytes = new Uint8Array(KITTY_CHUNK);
    const output = encodeKitty({ format: "png", bytes }, size, { tmux: true });
    const wrapped = output.split(`${ESC}Ptmux;`).slice(1);
    expect(wrapped).toHaveLength(2);
    for (const part of wrapped) {
      expect(part.startsWith(`${ESC}${ESC}_G`)).toBe(true);
      expect(part.endsWith(`${ESC}${ESC}\\${ESC}\\`)).toBe(true);
    }
  });
});
