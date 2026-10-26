import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const mobileRequire = createRequire(
  new URL("../../apps/mobile/package.json", import.meta.url),
);
const rendererRequire = createRequire(
  mobileRequire.resolve("react-native-markdown-display"),
);
const MarkdownIt = rendererRequire("markdown-it");

test("mobile Markdown keeps the token format consumed by its native renderer", () => {
  const parser = new MarkdownIt({ typographer: true, linkify: true });
  const tokens = parser.parse(
    "# Heading\n\n**bold** [Kaneo](https://kaneo.app)\n\n```ts\nconst n = 1;\n```",
    {},
  );
  assert.equal(tokens[0].type, "heading_open");
  assert.equal(tokens[0].nesting, 1);
  const inline = tokens.find(
    (token) => token.type === "inline" && token.content.startsWith("**bold**"),
  );
  assert.ok(inline.children.some((token) => token.type === "strong_open"));
  const link = inline.children.find((token) => token.type === "link_open");
  assert.deepEqual(link.attrs, [["href", "https://kaneo.app"]]);
  const fence = tokens.find((token) => token.type === "fence");
  assert.equal(fence.info, "ts");
  assert.equal(fence.content, "const n = 1;\n");
});

test("mobile Markdown continues rejecting executable links", () => {
  const parser = new MarkdownIt();
  const tokens = parser.parse("[unsafe](javascript:alert(1))", {});
  assert.ok(
    tokens.every(
      (token) =>
        token.children?.every((child) => child.type !== "link_open") ?? true,
    ),
  );
});
