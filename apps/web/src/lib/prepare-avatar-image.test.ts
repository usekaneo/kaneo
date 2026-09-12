import { describe, expect, it } from "vitest";
import { getCoverCropRect } from "./prepare-avatar-image";

describe("getCoverCropRect", () => {
  it("keeps a square image whole", () => {
    expect(getCoverCropRect(400, 400)).toEqual({
      sourceX: 0,
      sourceY: 0,
      side: 400,
    });
  });

  it("crops a landscape image around its center", () => {
    expect(getCoverCropRect(800, 400)).toEqual({
      sourceX: 200,
      sourceY: 0,
      side: 400,
    });
  });

  it("crops a portrait image around its center", () => {
    expect(getCoverCropRect(400, 900)).toEqual({
      sourceX: 0,
      sourceY: 250,
      side: 400,
    });
  });

  it("rounds an odd offset", () => {
    expect(getCoverCropRect(101, 100)).toEqual({
      sourceX: 1,
      sourceY: 0,
      side: 100,
    });
  });
});
