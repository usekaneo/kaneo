import { describe, expect, it } from "vitest";
import { normalizeCommentMarkdown } from "./normalize-comment-markdown";

describe("normalizeCommentMarkdown", () => {
  it("preserves explicit blank paragraphs", () => {
    const markdown = "This is a test comment\n\n\n\nThis is another paragraph";

    const result = normalizeCommentMarkdown(markdown);

    expect(result).toBe(markdown);
  });

  it("preserves the blank paragraph that separates a list from later text", () => {
    const markdown = "- Item\n\n\n\nNot a list item";

    const result = normalizeCommentMarkdown(markdown);

    expect(result).toBe(markdown);
  });

  it("normalizes platform newlines and non-breaking spaces", () => {
    const markdown = "First\r\nSecond&nbsp;\u00A0line";

    const result = normalizeCommentMarkdown(markdown);

    expect(result).toBe("First\nSecond  line");
  });

  it("preserves non-breaking spaces inside inline code", () => {
    const markdown = "Text&nbsp; `code&nbsp;\u00A0value` more\u00A0text";

    const result = normalizeCommentMarkdown(markdown);

    expect(result).toBe("Text  `code&nbsp;\u00A0value` more text");
  });

  it("preserves non-breaking spaces inside multiline inline code", () => {
    const markdown = "Text&nbsp; `code\n&nbsp;\u00A0value` more\u00A0text";

    const result = normalizeCommentMarkdown(markdown);

    expect(result).toBe("Text  `code\n&nbsp;\u00A0value` more text");
  });

  it("preserves non-breaking spaces inside fenced code blocks", () => {
    const markdown =
      "Before&nbsp;\n```html\n<div>&nbsp;\u00A0</div>\n```\nAfter\u00A0";

    const result = normalizeCommentMarkdown(markdown);

    expect(result).toBe(
      "Before \n```html\n<div>&nbsp;\u00A0</div>\n```\nAfter ",
    );
  });
});

it("preserves unequal and nested backtick runs without rescanning suffixes", () => {
  const value = "Before&nbsp; ``a`&nbsp;b`` after&nbsp; `unmatched&nbsp;";
  expect(normalizeCommentMarkdown(value)).toBe(
    "Before  ``a`&nbsp;b`` after  `unmatched ",
  );
});

it("handles a stored comment with thousands of unmatched delimiter lengths promptly", () => {
  const delimiters = Array.from(
    { length: 3000 },
    (_, i) => `${"`".repeat(3000 - i)}&nbsp;`,
  ).join(" ");
  const value = `prefix ${delimiters}`;
  const start = performance.now();
  const result = normalizeCommentMarkdown(value);
  expect(performance.now() - start).toBeLessThan(1000);
  expect(result).toBe(value.replaceAll("&nbsp;", " "));
});
