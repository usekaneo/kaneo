import { describe, expect, it } from "vite-plus/test";
import { boundBoardDescription } from "./bound-board-description";

describe("boundBoardDescription", () => {
  it("leaves patches without a description alone", () => {
    const patch = { title: "New title" };

    expect(boundBoardDescription(patch)).toBe(patch);
    expect(boundBoardDescription(undefined)).toBeUndefined();
  });

  it("keeps a description that fits on the board", () => {
    expect(boundBoardDescription({ description: "Short" })).toEqual({
      description: "Short",
      descriptionDeferred: false,
    });
  });

  it("drops a description over 64 KB and marks it deferred", () => {
    const description = "a".repeat(64 * 1024 + 1);

    expect(boundBoardDescription({ description })).toEqual({
      description: null,
      descriptionDeferred: true,
    });
  });

  it("measures bytes, not characters", () => {
    const description = "ä".repeat(40 * 1024);

    expect(boundBoardDescription({ description })).toMatchObject({
      descriptionDeferred: true,
    });
  });
});
