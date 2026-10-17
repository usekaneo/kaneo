import { describe, expect, it } from "vite-plus/test";
import { createHtmlToMarkdown } from "./html.js";

const toMarkdown = createHtmlToMarkdown({
  mentionName: (id) => (id === "user-1" ? "jane" : undefined),
});

describe("createHtmlToMarkdown", () => {
  it("treats empty editor HTML as an empty description", () => {
    expect(toMarkdown(null)).toBe("");
    expect(toMarkdown("")).toBe("");
    expect(toMarkdown("<p></p>")).toBe("");
    expect(toMarkdown('<p class="editor-paragraph-block"></p>')).toBe("");
    expect(toMarkdown("<p><br></p>")).toBe("");
  });

  it("converts headings, emphasis and links", () => {
    expect(
      toMarkdown(
        '<h2>Goal</h2><p>Ship <strong>fast</strong> and <em>safe</em>, see <a href="https://example.com/spec">the spec</a>.</p>',
      ),
    ).toBe(
      "## Goal\n\nShip **fast** and _safe_, see [the spec](https://example.com/spec).",
    );
  });

  it("writes tight bullet and numbered lists from editor paragraphs", () => {
    expect(
      toMarkdown(
        "<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ul><ol><li><p>first</p></li><li><p>second</p></li></ol>",
      ),
    ).toBe("- one\n  - nested\n- two\n\n1. first\n2. second");
  });

  it("converts Plane task lists to GFM checkboxes", () => {
    expect(
      toMarkdown(
        '<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>done</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>todo</p></div></li></ul>',
      ),
    ).toBe("- [x] done\n- [ ] todo");
  });

  it("indents nested task lists under their parent item", () => {
    expect(
      toMarkdown(
        '<ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>parent</p><ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>child</p></div></li></ul></div></li></ul>',
      ),
    ).toBe("- [ ] parent\n  - [x] child");
  });

  it("keeps fenced code blocks and inline code", () => {
    expect(
      toMarkdown(
        '<p>Run <code>pnpm test</code></p><pre><code class="language-ts">const a = 1;\nconst b = 2;</code></pre>',
      ),
    ).toBe("Run `pnpm test`\n\n```ts\nconst a = 1;\nconst b = 2;\n```");
  });

  it("degrades mentions to plain text", () => {
    expect(
      toMarkdown(
        '<p>Ping <mention-component id="m1" entity_identifier="user-1" entity_name="user_mention"></mention-component> and <mention-component label="Bob" entity_identifier="user-2"></mention-component></p>',
      ),
    ).toBe("Ping @jane and @Bob");
    expect(
      toMarkdown(
        '<p>Ping <span data-type="mention" data-id="user-9">@Sam</span> <mention-component entity_identifier="user-9" entity_name="user_mention"></mention-component>now</p>',
      ),
    ).toBe("Ping @Sam now");
  });

  it("escapes resolved mention names and drops unknown mentions", () => {
    const convert = createHtmlToMarkdown({ mentionName: () => "<R&D>" });
    expect(
      convert(
        '<p>Hi <mention-component entity_identifier="x" entity_name="user_mention"></mention-component></p>',
      ),
    ).toBe("Hi @<R&D>");
    expect(
      createHtmlToMarkdown()(
        '<p>Hi <mention-component entity_identifier="x"></mention-component></p>',
      ),
    ).toBe("Hi");
  });

  it("drops images that only live inside Plane", () => {
    expect(
      toMarkdown(
        '<p>Before</p><image-component src="asset-id" width="300"></image-component><img src="/api/assets/v2/abc/" alt=""><img src="https://cdn.example.com/a.png" alt="chart"><p>After</p>',
      ),
    ).toBe("Before\n\n![chart](https://cdn.example.com/a.png)\n\nAfter");
  });

  it("converts tables with a header row", () => {
    expect(
      toMarkdown(
        "<table><tbody><tr><th><p>Name</p></th><th><p>Owner</p></th></tr><tr><td><p>API</p></td><td><p>Jane</p></td></tr></tbody></table>",
      ),
    ).toBe("| Name | Owner |\n| --- | --- |\n| API | Jane |");
  });
});
