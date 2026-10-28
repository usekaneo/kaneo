import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";

const webRequire = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const mermaidRequire = createRequire(webRequire.resolve("mermaid"));
const katex = mermaidRequire("katex");

test("Mermaid's KaTeX ignores inherited trust while honoring explicit trust", () => {
  // GHSA-238p-pmpm-9mq7: a polluted options prototype must not enable links.
  const expression = String.raw`\href{https://example.com}{example}`;
  const inheritedOptions = Object.create({ trust: true });
  assert.doesNotMatch(
    katex.renderToString(expression, inheritedOptions),
    /<a\b/,
  );
  assert.match(katex.renderToString(expression, { trust: true }), /<a\b/);
});

test("Mermaid's KaTeX still renders math to HTML and MathML", () => {
  const output = katex.renderToString(String.raw`\sqrt{a^2 + b^2}`, {
    displayMode: true,
    throwOnError: true,
  });
  assert.match(output, /class="katex-display"/);
  assert.match(output, /<math\b/);
  assert.match(output, /class="katex-html"/);
});

test("Mermaid's KaTeX ESM import supports its MathML rendering contract", async () => {
  const { default: esmKatex } = await import(
    new URL("./katex.mjs", pathToFileURL(mermaidRequire.resolve("katex")))
  );
  const output = esmKatex.renderToString(String.raw`\sqrt{a^2 + b^2}`, {
    displayMode: true,
    throwOnError: true,
    output: "mathml",
  });
  assert.match(output, /<math\b/);
  assert.doesNotMatch(output, /class="katex-html"/);
  assert.throws(() =>
    esmKatex.renderToString(String.raw`\notacommand`, { throwOnError: true }),
  );
});
