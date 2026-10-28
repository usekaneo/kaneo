import { describe, expect, it } from "vite-plus/test";
import { pickBoard } from "./board.js";

describe("pickBoard", () => {
  it("prefers the board that lives in the project", () => {
    expect(
      pickBoard(
        [
          { id: 1, location: { projectKey: "OPS" } },
          { id: 2, location: { projectKey: "abc" } },
        ],
        "ABC",
      )?.id,
    ).toBe(2);
  });

  it("falls back to the first board and handles no boards", () => {
    expect(pickBoard([{ id: 5 }, { id: 6 }], "ABC")?.id).toBe(5);
    expect(pickBoard([], "ABC")).toBeUndefined();
  });
});
