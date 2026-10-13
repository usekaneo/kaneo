import { parse } from "@babel/parser";

function parserOptions(file) {
  const typescript = /\.[cm]?tsx?$/.test(file);
  return {
    sourceType: "unambiguous",
    allowReturnOutsideFunction: true,
    plugins: typescript
      ? [
          "decorators-legacy",
          "typescript",
          ...(file.endsWith(".tsx") ? ["jsx"] : []),
        ]
      : ["decorators-legacy", ["flow", { all: true }], "jsx"],
  };
}

function codeOnly(comment, file) {
  const text = comment
    .replace(/^\s*\/\*+|\*\/\s*$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:\/\/|\*)\s?/, ""))
    .join("\n")
    .trim();
  if (!/[;{}=()]/.test(text)) return false;
  try {
    const ast = parse(text, parserOptions(file));
    return ast.program.body.length > 0;
  } catch {
    return false;
  }
}

export function changedComments(source, file, lines) {
  const ast = parse(source, parserOptions(file));
  const groups = [];
  const lineStart = (index) =>
    !source.slice(source.lastIndexOf("\n", index - 1) + 1, index).trim();

  for (const comment of ast.comments ?? []) {
    const previous = groups.at(-1);
    const text = source.slice(comment.start, comment.end);
    if (
      comment.type === "CommentLine" &&
      previous?.type === "CommentLine" &&
      comment.loc.start.line === previous.endLine + 1 &&
      lineStart(comment.start) &&
      lineStart(previous.start)
    ) {
      previous.text += `\n${text}`;
      previous.endLine = comment.loc.end.line;
    } else {
      groups.push({
        text,
        start: comment.start,
        line: comment.loc.start.line,
        endLine: comment.loc.end.line,
        type: comment.type,
      });
    }
  }

  return groups.filter((group) => {
    if (/__GDPR__|__GDPR__FRAGMENT__/.test(group.text)) return false;
    let changed = false;
    for (let line = group.line; line <= group.endLine; line++) {
      if (lines.has(line)) {
        changed = true;
        break;
      }
    }
    return changed && !codeOnly(group.text, file);
  });
}
