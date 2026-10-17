import { EventEmitter } from "node:events";
import { describe, expect, it } from "vite-plus/test";
import { exitOnClosedPipe } from "./exit-on-closed-pipe.js";

function failingStream(code: string) {
  const stream = new EventEmitter();
  return {
    stream,
    fail: () => stream.emit("error", Object.assign(new Error(code), { code })),
  };
}

describe("exitOnClosedPipe", () => {
  it("exits quietly when the reader closes the pipe", () => {
    const exits: number[] = [];
    const { stream, fail } = failingStream("EPIPE");
    exitOnClosedPipe([stream], (code) => exits.push(code));
    fail();
    expect(exits).toEqual([0]);
  });

  it("rethrows other stream errors", () => {
    const { stream, fail } = failingStream("EIO");
    exitOnClosedPipe([stream], () => {});
    expect(fail).toThrow("EIO");
  });
});
