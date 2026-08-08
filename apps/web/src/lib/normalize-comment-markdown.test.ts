import { describe, expect, it } from "vitest";
import { normalizeCommentMarkdown } from "./normalize-comment-markdown";

describe("normalizeCommentMarkdown", () => {
  it("preserves explicit blank paragraphs", () => {
    expect(
      normalizeCommentMarkdown(
        "This is a test comment\n\n\n\nThis is another paragraph",
      ),
    ).toBe("This is a test comment\n\n\n\nThis is another paragraph");
  });

  it("preserves the blank paragraph that separates a list from later text", () => {
    expect(normalizeCommentMarkdown("- Item\n\n\n\nNot a list item")).toBe(
      "- Item\n\n\n\nNot a list item",
    );
  });

  it("normalizes platform newlines and non-breaking spaces", () => {
    expect(normalizeCommentMarkdown("First\r\nSecond&nbsp;\u00A0line")).toBe(
      "First\nSecond  line",
    );
  });
});
