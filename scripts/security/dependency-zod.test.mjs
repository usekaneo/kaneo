import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const mcpRequire = createRequire(
  new URL("../../packages/mcp/package.json", import.meta.url),
);
const { z } = mcpRequire("zod");

test("oversized constrained MCP arrays fail before parsing any element", async () => {
  // GHSA-mrhx-c7xc-m3w5: a size bound must also bound validation work.
  let parsed = 0;
  const element = z.string().refine(() => {
    parsed += 1;
    return true;
  });
  const schema = z.array(element).max(2);
  for (const result of [
    schema.safeParse(["a", "b", "c"]),
    await schema.safeParseAsync(["a", "b", "c"]),
  ]) {
    assert.equal(result.success, false);
    assert.deepEqual(
      result.error.issues.map(({ code }) => code),
      ["too_big"],
    );
  }
  assert.equal(parsed, 0);
  assert.deepEqual(schema.parse(["a", "b"]), ["a", "b"]);
  assert.equal(parsed, 2);
});
