import { Readable } from "node:stream";
import { describe, expect, it } from "vite-plus/test";
import { readStream } from "./read-stdin.js";

describe("readStream", () => {
  it("joins string chunks", async () => {
    expect(await readStream(Readable.from(["Looks ", "good\n"]))).toBe(
      "Looks good\n",
    );
  });

  it("decodes UTF-8 split across byte chunks", async () => {
    const bytes = new TextEncoder().encode("Café ✓");
    const chunks = [bytes.slice(0, 4), bytes.slice(4, 6), bytes.slice(6)];
    expect(await readStream(Readable.from(chunks))).toBe("Café ✓");
  });

  it("returns an empty string for an empty stream", async () => {
    expect(await readStream(Readable.from([]))).toBe("");
  });
});
