export type ClassSelector = {
  readonly selector: string;
  readonly name: string;
};

const IDENTIFIER_CHAR = String.raw`(?:[_a-zA-Z0-9\u0080-\uFFFF-]|\\[0-9a-fA-F]{1,6}[ \t\n\r\f]?|\\[^\n\r\f0-9a-fA-F])`;
const IDENTIFIER_START = String.raw`(?:[_a-zA-Z\u0080-\uFFFF]|\\[0-9a-fA-F]{1,6}[ \t\n\r\f]?|\\[^\n\r\f0-9a-fA-F])`;
const CLASS_PATTERN = new RegExp(
  String.raw`\.(-?${IDENTIFIER_START}${IDENTIFIER_CHAR}*)`,
  "g",
);
const COMMENT_OR_STRING =
  /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g;
const ESCAPE = /\\(?:([0-9a-fA-F]{1,6})[ \t\n\r\f]?|([^\n\r\f]))/g;

function stripCommentsAndStrings(css: string): string {
  return css.replace(COMMENT_OR_STRING, (match) =>
    match.startsWith("/*") ? " " : '""',
  );
}

function selectorPreludes(css: string): string[] {
  const preludes: string[] = [];
  let start = 0;
  for (let index = 0; index < css.length; index++) {
    const char = css[index];
    if (char === "\\") {
      index++;
    } else if (char === "{") {
      const prelude = css.slice(start, index).trim();
      if (prelude && !prelude.startsWith("@")) preludes.push(prelude);
      start = index + 1;
    } else if (char === "}" || char === ";") {
      start = index + 1;
    }
  }
  return preludes;
}

function unescapeIdentifier(raw: string): string {
  return raw.replace(ESCAPE, (_match, hex: string | undefined, char = "") => {
    if (!hex) return char;
    const code = Number.parseInt(hex, 16);
    return code === 0 || code > 0x10ffff
      ? "\uFFFD"
      : String.fromCodePoint(code);
  });
}

export function findClassSelectors(css: string): ClassSelector[] {
  const selectors: ClassSelector[] = [];
  for (const prelude of selectorPreludes(stripCommentsAndStrings(css))) {
    for (const match of prelude.matchAll(CLASS_PATTERN)) {
      const raw = match[1] ?? "";
      selectors.push({
        selector: `.${raw.trimEnd()}`,
        name: unescapeIdentifier(raw),
      });
    }
  }
  return selectors;
}
