import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { imageArt } from "./image-art.js";
import { jpegBytes, pngBytes, solid } from "./image-fixtures.js";
import type { ImageTarget } from "./image-target.js";

const target = (
  protocol: ImageTarget["protocol"],
  tmux = false,
): ImageTarget => ({
  protocol,
  tmux,
  level: 3,
  background: null,
});

const red = pngBytes(4, 4, solid(4, 4, [255, 0, 0, 255]));
const gif = new Uint8Array([
  ...Array.from("GIF89a", (character) => character.charCodeAt(0)),
  16,
  0,
  16,
  0,
]);

function withDeclaredSize(png: Uint8Array, width: number, height: number) {
  const copy = new Uint8Array(png);
  const view = new DataView(copy.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return copy;
}

const run = (bytes: Uint8Array, at: ImageTarget, maxColumns = 64) =>
  Effect.runPromise(imageArt(bytes, at, { maxColumns }));

describe("imageArt", () => {
  it("draws decoded pixels as blocks without scaling them up", async () => {
    const art = await run(red, target("blocks"));
    expect(art).toEqual({
      _tag: "Art",
      columns: 4,
      rows: 2,
      lines: [
        "\u001b[38;2;255;0;0;48;2;255;0;0m▀▀▀▀\u001b[39;49m",
        "\u001b[38;2;255;0;0;48;2;255;0;0m▀▀▀▀\u001b[39;49m",
      ],
    });
  });

  it("sends PNG bytes to kitty as they are", async () => {
    const art = await run(red, target("kitty"));
    expect(art._tag).toBe("Art");
    if (art._tag === "Art") {
      expect(art.lines).toHaveLength(1);
      expect(art.lines[0]).toContain("a=T,f=100,t=d,c=1,r=1,q=2");
    }
  });

  it("decodes JPEG for kitty and sends compressed pixels", async () => {
    const jpeg = jpegBytes(32, 16, solid(32, 16, [0, 0, 255, 255]));
    const art = await run(jpeg, target("kitty", true));
    expect(art._tag).toBe("Art");
    if (art._tag === "Art") {
      expect(art.lines[0]).toContain("a=T,f=32,s=32,v=16,o=z,t=d,c=4,r=1");
      expect(art.lines[0]?.startsWith("\u001bPtmux;")).toBe(true);
    }
  });

  it("sends any common format to iTerm2", async () => {
    const art = await run(gif, target("iterm"));
    expect(art._tag).toBe("Art");
    if (art._tag === "Art") {
      expect(art.lines[0]).toContain("width=2;height=1;preserveAspectRatio=1");
    }
  });

  it("refuses images whose declared size would overload the terminal", async () => {
    const huge = withDeclaredSize(red, 100_000, 100_000);
    for (const protocol of ["kitty", "iterm"] as const) {
      expect(await run(huge, target(protocol))).toEqual({
        _tag: "Unsupported",
        reason: "100000x100000 is too large to show",
      });
    }
  });

  it("explains formats that cannot be shown", async () => {
    expect(await run(gif, target("blocks"))).toEqual({
      _tag: "Unsupported",
      reason: "GIF cannot be shown here",
    });
    expect(await run(gif, target("kitty"))).toMatchObject({
      _tag: "Unsupported",
    });
    expect(
      await run(new TextEncoder().encode("<svg></svg>"), target("iterm")),
    ).toEqual({ _tag: "Unsupported", reason: "SVG cannot be shown here" });
  });

  it("reports images it cannot decode", async () => {
    const broken = new Uint8Array(red);
    broken.fill(0, 40);
    expect(await run(broken, target("blocks"))).toEqual({
      _tag: "Unsupported",
      reason: "could not decode",
    });
  });
});
