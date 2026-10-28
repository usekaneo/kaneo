import { describe, expect, it } from "vite-plus/test";
import { parseMentionRefs, sameMentionRefs } from "./mention-token";

describe("parseMentionRefs", () => {
  it("returns distinct task and project references in order", () => {
    expect(
      parseMentionRefs(
        "Plan @[Launch v3](project:p1) from @[WEB-135 Fix login](task:t1), then @[Launch v3](project:p1) again",
      ),
    ).toEqual([
      { type: "project", id: "p1" },
      { type: "task", id: "t1" },
    ]);
  });

  it("ignores plain @ text, emails, and malformed tokens", () => {
    expect(
      parseMentionRefs(
        "Ask @jordan or tin@northwind.dev about @[x](user:u1) and @[](task:t1) and @[y](task:)",
      ),
    ).toEqual([]);
  });
});

describe("sameMentionRefs", () => {
  it("ignores order", () => {
    expect(
      sameMentionRefs(
        [
          { type: "task", id: "a" },
          { type: "project", id: "b" },
        ],
        [
          { type: "project", id: "b" },
          { type: "task", id: "a" },
        ],
      ),
    ).toBe(true);
    expect(
      sameMentionRefs(
        [{ type: "task", id: "a" }],
        [{ type: "project", id: "a" }],
      ),
    ).toBe(false);
  });
});
