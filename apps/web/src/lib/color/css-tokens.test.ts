import { describe, expect, it } from "vite-plus/test";
import { readTokenBlock } from "./css-tokens";

const sample = `
:root {
  --top: 1;
}

:root.dark {
  --nested-scheme: 2;
}

@media (forced-colors: active) {
  :root {
    --top: 3;
    --system: 4;
  }
}
`;

describe("readTokenBlock", () => {
  it("reads a top-level block and ignores conditional blocks that reuse the selector", () => {
    expect([...readTokenBlock(sample, ":root")]).toEqual([["--top", "1"]]);
  });

  it("matches a whole selector, not a prefix of a longer one", () => {
    expect(readTokenBlock(sample, ":root").has("--nested-scheme")).toBe(false);
  });
});
