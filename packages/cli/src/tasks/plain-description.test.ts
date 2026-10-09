import { describe, expect, it } from "vite-plus/test";
import { stringWidth } from "../render/width.js";
import { inlineText, plainDescription, wrapText } from "./plain-description.js";

const plain = (source: string, width = 80, maxLines?: number) =>
  plainDescription(source, { width, unicode: true, maxLines }).lines.map(
    (line) => line.text,
  );

describe("inlineText", () => {
  it("drops emphasis markers", () => {
    expect(
      inlineText(
        "**bold** and *italic* and _under_ and ~~gone~~ and ++under++",
      ),
    ).toBe("bold and italic and under and gone and under");
  });

  it("keeps snake_case words and lone stars", () => {
    expect(inlineText("set max_retry_count to 2 * 3 * 4")).toBe(
      "set max_retry_count to 2 * 3 * 4",
    );
  });

  it("shows code spans literally", () => {
    expect(inlineText("run `pnpm **dev**` now")).toBe("run pnpm **dev** now");
  });

  it("unescapes markdown punctuation without formatting it", () => {
    expect(inlineText("\\*not italic\\* and \\[x\\] and a\\_b")).toBe(
      "*not italic* and [x] and a_b",
    );
  });

  it("decodes entities", () => {
    expect(inlineText("Option&lt;string&gt; &amp; &#x1F600; &#99999999;")).toBe(
      "Option<string> & \u{1F600} &#99999999;",
    );
  });

  it("writes links as text and url", () => {
    expect(
      inlineText(
        "see [the docs](https://kaneo.app/docs_page_x) or <https://kaneo.app>",
      ),
    ).toBe("see the docs (https://kaneo.app/docs_page_x) or https://kaneo.app");
    expect(inlineText("[https://kaneo.app](https://kaneo.app)")).toBe(
      "https://kaneo.app",
    );
    expect(inlineText("[ada@example.com](mailto:ada@example.com)")).toBe(
      "ada@example.com",
    );
  });

  it("names images and attachments", () => {
    expect(
      inlineText("![diagram](https://cdn/x.png) ![](https://cdn/y.png)"),
    ).toBe("[image: diagram] [image]");
    expect(
      inlineText('<img src="https://cdn/x.png" alt="wide" width="320" />'),
    ).toBe("[image: wide]");
    expect(
      inlineText(
        '<kaneo-attachment url="https://cdn/r.pdf" filename="report.pdf" mime-type="application/pdf" size="10" />',
      ),
    ).toBe("[attachment: report.pdf]");
  });

  it("reads Kaneo mentions, issue links and embeds", () => {
    expect(
      inlineText(
        'ping <kaneo-mention id="u1" label="Ada Lovelace"></kaneo-mention>',
      ),
    ).toBe("ping @Ada Lovelace");
    expect(
      inlineText(
        '<kaneo-issue-link url="https://app/task/1" issue-key="KAN-3" task-id="1" />',
      ),
    ).toBe("KAN-3");
    expect(
      inlineText('<kaneo-embed url="https://youtu.be/x" mode="embed" />'),
    ).toBe("https://youtu.be/x");
  });

  it("strips known html tags but keeps generic angle brackets", () => {
    expect(inlineText("<strong>Hi</strong><br>there, Vec<String> stays")).toBe(
      "Hi there, Vec<String> stays",
    );
  });
});

describe("wrapText", () => {
  it("wraps on words with a hanging prefix", () => {
    expect(wrapText("one two three four five", 12, "- ", "  ")).toEqual([
      "- one two",
      "  three four",
      "  five",
    ]);
  });

  it("splits words longer than the line", () => {
    expect(wrapText("https://example.com/a/very/long/path", 12)).toEqual([
      "https://exam",
      "ple.com/a/ve",
      "ry/long/path",
    ]);
  });
});

describe("plainDescription", () => {
  it("returns nothing for an empty description", () => {
    expect(plain("")).toEqual([]);
    expect(plain("\n\n  \n")).toEqual([]);
  });

  it("renders headings, paragraphs and lists", () => {
    const source = [
      "## Steps",
      "",
      "Open the **board** and drag a card.",
      "",
      "- First",
      "  - Nested",
      "1. Numbered",
      "- [ ] Todo",
      "- [x] Done",
    ].join("\n");
    const result = plainDescription(source, { width: 80, unicode: true });
    expect(result.lines.map((line) => line.text)).toEqual([
      "Steps",
      "",
      "Open the board and drag a card.",
      "",
      "• First",
      "  • Nested",
      "1. Numbered",
      "[ ] Todo",
      "[x] Done",
    ]);
    expect(result.lines[0]?.kind).toBe("heading");
  });

  it("uses ascii bullets without unicode", () => {
    expect(
      plainDescription("- item", { width: 80, unicode: false }).lines.map(
        (line) => line.text,
      ),
    ).toEqual(["- item"]);
  });

  it("keeps hard breaks as separate lines", () => {
    expect(plain("first line  \nsecond line\\\nthird")).toEqual([
      "first line",
      "second line",
      "third",
    ]);
  });

  it("collapses runs of blank lines", () => {
    expect(plain("a\n\n\n\nb")).toEqual(["a", "", "b"]);
  });

  it("wraps prose to the width with hanging list indents", () => {
    const lines = plain(
      "- This list item is long enough that it needs to wrap onto a second line here.",
      40,
    );
    expect(lines).toEqual([
      "• This list item is long enough that it",
      "  needs to wrap onto a second line here.",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(40);
  });

  it("keeps code blocks verbatim and truncates instead of wrapping", () => {
    const source = [
      "```ts",
      "const value = **not bold**;",
      "const long = 'abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz';",
      "```",
    ].join("\n");
    expect(plain(source, 40)).toEqual([
      "  const value = **not bold**;",
      "  const long = 'abcdefghijklmnopqrstuvw…",
    ]);
  });

  it("aligns tables and never wraps them", () => {
    const source = [
      "| Name | Role |",
      "| --- | --- |",
      "| Ada Lovelace | Engineer |",
      "| Grace \\| Hopper | Admiral of the fleet with a very long title |",
    ].join("\n");
    const lines = plain(source, 40);
    expect(lines).toEqual([
      "Name            Role",
      "──────────────  ───────────────────────…",
      "Ada Lovelace    Engineer",
      "Grace | Hopper  Admiral of the fleet wi…",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(40);
  });

  it("marks quotes and rules", () => {
    const result = plainDescription("> quoted *text*\n\n---", {
      width: 80,
      unicode: true,
    });
    expect(result.lines.map((line) => [line.text, line.kind])).toEqual([
      ["│ quoted text", "muted"],
      ["", "text"],
      ["────────────────────────", "muted"],
    ]);
  });

  it("drops html comments", () => {
    expect(plain("before <!-- hidden\nstill hidden --> after")).toEqual([
      "before after",
    ]);
  });

  it("stops at maxLines and reports the cut", () => {
    const source = Array.from(
      { length: 60 },
      (_, index) => `line ${index + 1}`,
    ).join("\n");
    const result = plainDescription(source, {
      width: 80,
      unicode: true,
      maxLines: 40,
    });
    expect(result.truncated).toBe(true);
    expect(result.lines).toHaveLength(40);
    expect(result.lines[39]?.text).toBe("line 40");
    expect(
      plainDescription("short", { width: 80, unicode: true, maxLines: 40 })
        .truncated,
    ).toBe(false);
  });
});
