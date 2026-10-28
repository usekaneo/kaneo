import { describe, expect, it } from "vite-plus/test";
import { resizeRgba } from "./resize-rgba.js";

describe("resizeRgba", () => {
  it("averages each block of source pixels", () => {
    const image = {
      width: 2,
      height: 2,
      data: new Uint8Array([
        0, 0, 0, 255, 100, 100, 100, 255, 200, 200, 200, 255, 100, 100, 100,
        255,
      ]),
    };
    expect([...resizeRgba(image, 1, 1).data]).toEqual([100, 100, 100, 255]);
  });

  it("ignores the color of transparent pixels", () => {
    const image = {
      width: 2,
      height: 1,
      data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 0]),
    };
    expect([...resizeRgba(image, 1, 1).data]).toEqual([255, 0, 0, 128]);
  });

  it("repeats pixels when it has to scale up", () => {
    const image = { width: 1, height: 1, data: new Uint8Array([1, 2, 3, 4]) };
    expect([...resizeRgba(image, 2, 1).data]).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it("returns the same image when the size already matches", () => {
    const image = { width: 1, height: 1, data: new Uint8Array([1, 2, 3, 4]) };
    expect(resizeRgba(image, 1, 1)).toBe(image);
  });
});
