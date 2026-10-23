import { describe, expect, it } from "vite-plus/test";
import { boardEntryColumn } from "./board-entry-column";

const column = (slug: string, isFinal = false) => ({ slug, isFinal });

describe("boardEntryColumn", () => {
  it("prefers the To Do column wherever it sits", () => {
    expect(
      boardEntryColumn([
        column("triage"),
        column("to-do"),
        column("done", true),
      ])?.slug,
    ).toBe("to-do");
  });

  it("falls back to the first open column of a custom workflow", () => {
    expect(
      boardEntryColumn([
        column("shipped", true),
        column("ideas"),
        column("doing"),
      ])?.slug,
    ).toBe("ideas");
  });

  it("has nowhere to go when every column is final", () => {
    expect(boardEntryColumn([column("done", true)])).toBeUndefined();
    expect(boardEntryColumn(undefined)).toBeUndefined();
  });
});
