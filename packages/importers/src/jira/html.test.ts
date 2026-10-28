import { describe, expect, it } from "vite-plus/test";
import { createJiraHtmlToMarkdown } from "./html.js";

const toMarkdown = createJiraHtmlToMarkdown("https://jira.example.com/jira");

describe("createJiraHtmlToMarkdown", () => {
  it("treats empty HTML as an empty description", () => {
    expect(toMarkdown(null)).toBe("");
    expect(toMarkdown(undefined)).toBe("");
    expect(toMarkdown("  ")).toBe("");
    expect(toMarkdown("<p></p>")).toBe("");
  });

  it("converts headings, emphasis, strikethrough and rules", () => {
    expect(
      toMarkdown(
        '<h2><a name="Goal"></a>Goal</h2>\n<p>Ship <b>fast</b> and <em>safe</em>, not <del>slow</del>.<br/>\nNext line</p>\n<hr />\n<p>End</p>',
      ),
    ).toBe(
      "## Goal\n\nShip **fast** and _safe_, not ~slow~.  \nNext line\n\n---\n\nEnd",
    );
  });

  it("writes tight nested lists", () => {
    expect(
      toMarkdown(
        '<ul class="alternate" type="square">\n\t<li>one\n\t<ul class="alternate" type="square">\n\t\t<li>nested</li>\n\t</ul>\n\t</li>\n\t<li>two</li>\n</ul>\n\n<ol>\n\t<li>first</li>\n\t<li>second</li>\n</ol>',
      ),
    ).toBe("- one\n  - nested\n- two\n\n1. first\n2. second");
  });

  it("keeps lists made of paragraphs tight", () => {
    expect(
      toMarkdown(
        "<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ul>",
      ),
    ).toBe("- one\n  - nested\n- two");
  });

  it("turns Jira code panels into fenced blocks with their language", () => {
    expect(
      toMarkdown(
        '<div class="code panel" style="border-width: 1px;"><div class="codeContent panelContent">\n<pre class="code-java"><span class="code-keyword">public</span> <span class="code-keyword">class</span> Foo {\n  <span class="code-object">String</span> name = <span class="code-quote">"a_b"</span>;\n}\n</pre>\n</div></div>',
      ),
    ).toBe('```java\npublic class Foo {\n  String name = "a_b";\n}\n```');
  });

  it("turns noformat blocks into plain fences and keeps markdown characters", () => {
    expect(
      toMarkdown(
        '<div class="preformatted panel" style="border-width: 1px;"><div class="preformattedContent panelContent">\n<pre>raw *text* with ```fences```</pre>\n</div></div>',
      ),
    ).toBe("````\nraw *text* with ```fences```\n````");
  });

  it("keeps inline monospace", () => {
    expect(toMarkdown("<p>Run <tt>pnpm test</tt> and <tt>a`b</tt></p>")).toBe(
      "Run `pnpm test` and ``a`b``",
    );
  });

  it("turns panels and info macros into quotes", () => {
    expect(
      toMarkdown(
        '<div class="panel" style="border-width: 1px;"><div class="panelHeader" style="border-bottom-width: 1px;"><b>Heads up</b></div><div class="panelContent">\n<p>Mind the gap.</p>\n</div></div>',
      ),
    ).toBe("> **Heads up**\n> \n> Mind the gap.");
    expect(
      toMarkdown(
        '<div class="aui-message information shadowed information-macro"><span class="aui-icon icon-info">Icon</span><div class="message-content"><p>Read this first.</p></div></div>',
      ),
    ).toBe("> Read this first.");
  });

  it("converts tables with and without a header row", () => {
    expect(
      toMarkdown(
        "<div class='table-wrap'>\n<table class='confluenceTable'><tbody>\n<tr>\n<th class='confluenceTh'>Name</th>\n<th class='confluenceTh'>Owner</th>\n</tr>\n<tr>\n<td class='confluenceTd'>API</td>\n<td class='confluenceTd'><p>Jane</p><p>Bob</p></td>\n</tr>\n</tbody></table>\n</div>",
      ),
    ).toBe("| Name | Owner |\n| --- | --- |\n| API | Jane Bob |");
    expect(
      toMarkdown(
        "<table class='confluenceTable'><tbody>\n<tr>\n<td class='confluenceTd'>a</td>\n<td class='confluenceTd'>b</td>\n</tr>\n<tr>\n<td class='confluenceTd'>c</td>\n<td class='confluenceTd'>d</td>\n</tr>\n</tbody></table>",
      ),
    ).toBe("| a | b |\n| --- | --- |\n| c | d |");
  });

  it("degrades user mentions to plain text", () => {
    expect(
      toMarkdown(
        '<p>Ping <a href="https://jira.example.com/jira/secure/ViewProfile.jspa?name=fred" class="user-hover" rel="fred">Fred Flintstone</a> and <a href="/jira/secure/ViewProfile.jspa?accountId=5b10" data-account-id="5b10" accountid="5b10">@Ada</a></p>',
      ),
    ).toBe("Ping @Fred Flintstone and @Ada");
  });

  it("keeps absolute links and resolves site relative ones", () => {
    expect(
      toMarkdown(
        '<p>See <a href="https://jira.example.com/jira/browse/ABC-2" title="Fix it" class="issue-link" data-issue-key="ABC-2">ABC-2</a>, <a href="/jira/browse/ABC-3">ABC-3</a>, <a href="#anchor">here</a> and <a href="https://example.com/a (b)" class="external-link" rel="nofollow">docs</a></p>',
      ),
    ).toBe(
      "See [ABC-2](https://jira.example.com/jira/browse/ABC-2), [ABC-3](https://jira.example.com/jira/browse/ABC-3), here and [docs](https://example.com/a%20%28b%29)",
    );
  });

  it("keeps only absolute images and maps emoticons", () => {
    expect(
      toMarkdown(
        '<p>Before <img class="emoticon" src="https://jira.example.com/jira/images/icons/emoticons/check.png" height="16" width="16" align="absmiddle" alt="" border="0"/></p><p><span class="image-wrap" style=""><img src="https://jira.example.com/jira/secure/attachment/10000/shot.png" style="border: 0px solid black" /></span></p><p><img src="/rest/api/3/attachment/content/10001" alt="diagram.png" /></p><p><img src="blob:abc" /></p><p>After</p>',
      ),
    ).toBe(
      "Before ✅\n\n![](https://jira.example.com/jira/secure/attachment/10000/shot.png)\n\ndiagram.png\n\nAfter",
    );
  });

  it("keeps quotes", () => {
    expect(toMarkdown("<blockquote><p>Quoted</p></blockquote>")).toBe(
      "> Quoted",
    );
  });
});
