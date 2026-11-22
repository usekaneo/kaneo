/**
 * Read the custom properties declared in one top-level CSS rule block.
 *
 * Selectors are matched as a whole entry of a comma-separated selector list, so
 * `:root` never matches `:root.dark`. Blocks nested inside at-rules (for example
 * a `@media (forced-colors: active)` override) are ignored: this reads the
 * unconditional token block. Comments are stripped first so a commented-out
 * declaration never counts.
 */
export function readTokenBlock(
  css: string,
  selector: string,
): Map<string, string> {
  const tokens = new Map<string, string>();
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectorTarget = selector.trim();

  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("{", index);
    if (open === -1) break;

    let depth = 0;
    let close = open;
    for (; close < source.length; close++) {
      if (source[close] === "{") depth++;
      else if (source[close] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) break;

    const selectors = source
      .slice(index, open)
      .split(",")
      .map((entry) => entry.trim());

    if (selectors.includes(selectorTarget)) {
      const body = source.slice(open + 1, close);
      const declaration = /(^|;)\s*(--[\w-]+)\s*:\s*([^;]+)/g;
      for (const match of body.matchAll(declaration)) {
        tokens.set(match[2], match[3].trim());
      }
    }

    index = close + 1;
  }

  return tokens;
}
