import { describe, expect, it } from "vite-plus/test";

import { isLegacyHtml, legacyHtmlToMarkdown } from "./legacy-html";

describe("legacy HTML descriptions", () => {
  it("only treats text that starts with a block tag as HTML", () => {
    expect(isLegacyHtml("<p>Hello</p>")).toBe(true);
    expect(isLegacyHtml('  <ul class="x"><li>a</li></ul>')).toBe(true);
    expect(isLegacyHtml("Hello <p> world")).toBe(false);
    expect(isLegacyHtml("```html\n<p>x</p>\n```")).toBe(false);
    expect(isLegacyHtml('<kaneo-mention id="1"></kaneo-mention>')).toBe(false);
  });

  it("converts paragraphs and inline marks", () => {
    expect(
      legacyHtmlToMarkdown(
        "<p>Hello <strong>bold</strong> and <em>soft</em> &amp; <code>x &lt; y</code></p><p>Next<br>line</p>",
      ),
    ).toBe("Hello **bold** and _soft_ & `x < y`\n\nNext  \nline");
  });

  it("keeps Markdown characters in text literal", () => {
    expect(
      legacyHtmlToMarkdown(
        "<p>Use *literal* markers, [draft](notes) and <code>a*b</code></p><p>1. not a list</p>",
      ),
    ).toBe(
      "Use \\*literal\\* markers, \\[draft\\](notes) and `a*b`\n\n1\\. not a list",
    );
  });

  it("converts editor task lists with their checked state", () => {
    const html =
      '<ul class="not-prose pl-2" data-type="taskList"><li class="flex gap-2 items-start" data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Move the instances.json</p></div></li><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Use a $schema</p></div></li></ul>';
    expect(legacyHtmlToMarkdown(html)).toBe(
      "- [ ] Move the instances.json\n- [x] Use a $schema",
    );
  });

  it("keeps nested and ordered lists", () => {
    expect(
      legacyHtmlToMarkdown(
        '<ol start="3"><li><p>One</p><ul><li><p>Inner</p></li></ul></li><li><p>Two</p></li></ol><p>After</p>',
      ),
    ).toBe("3. One\n   - Inner\n4. Two\n\nAfter");
  });

  it("converts headings, links, quotes, and code blocks", () => {
    expect(
      legacyHtmlToMarkdown(
        '<h2>Title</h2><p>See <a href="https://kaneo.app" target="_blank">site</a></p><blockquote><p>Quote</p><p>More</p></blockquote><pre><code class="language-ts">const a = 1 &lt; 2;\n</code></pre>',
      ),
    ).toBe(
      "## Title\n\nSee [site](https://kaneo.app)\n\n> Quote\n>\n> More\n\n```\nconst a = 1 < 2;\n\n```",
    );
  });

  it("keeps images and Kaneo tags for the display rewrite", () => {
    expect(
      legacyHtmlToMarkdown(
        '<p>Hi <kaneo-mention id="u1" label="Ana">@Ana</kaneo-mention></p><img src="/api/asset/1" alt="shot">',
      ),
    ).toBe(
      'Hi <kaneo-mention id="u1" label="Ana">@Ana</kaneo-mention>\n\n<img src="/api/asset/1" alt="shot">',
    );
  });
});
