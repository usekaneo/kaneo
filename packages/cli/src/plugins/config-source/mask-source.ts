export function maskSource(source: string): string | null {
  const chars = source.split("");
  const length = chars.length;
  let index = 0;

  function blank(from: number, to: number): void {
    for (let position = from; position < to; position++) {
      if (chars[position] !== "\n" && chars[position] !== "\r") {
        chars[position] = " ";
      }
    }
  }

  function skipString(quote: string): boolean {
    let position = index + 1;
    while (position < length) {
      const char = chars[position];
      if (char === "\\") {
        position += 2;
      } else if (char === quote) {
        blank(index + 1, position);
        index = position + 1;
        return true;
      } else if (char === "\n") {
        return false;
      } else {
        position += 1;
      }
    }
    return false;
  }

  function skipTemplate(): boolean {
    const start = index;
    index += 1;
    while (index < length) {
      const char = chars[index];
      if (char === "\\") {
        index += 2;
      } else if (char === "`") {
        blank(start + 1, index);
        index += 1;
        return true;
      } else if (char === "$" && chars[index + 1] === "{") {
        index += 2;
        if (!skipCode(true)) return false;
      } else {
        index += 1;
      }
    }
    return false;
  }

  function skipComment(): boolean | null {
    const next = chars[index + 1];
    if (next === "/") {
      let end = index;
      while (end < length && chars[end] !== "\n") end += 1;
      blank(index, end);
      index = end;
      return true;
    }
    if (next === "*") {
      let end = index + 2;
      while (end < length && !(chars[end] === "*" && chars[end + 1] === "/")) {
        end += 1;
      }
      if (end >= length) return false;
      blank(index, end + 2);
      index = end + 2;
      return true;
    }
    return null;
  }

  function skipCode(untilBrace: boolean): boolean {
    let depth = 0;
    while (index < length) {
      const char = chars[index];
      if (char === "/") {
        const skipped = skipComment();
        if (skipped === false) return false;
        if (skipped) continue;
      } else if (char === '"' || char === "'") {
        if (!skipString(char)) return false;
        continue;
      } else if (char === "`") {
        if (!skipTemplate()) return false;
        continue;
      } else if (untilBrace && char === "{") {
        depth += 1;
      } else if (untilBrace && char === "}") {
        if (depth === 0) {
          index += 1;
          return true;
        }
        depth -= 1;
      }
      index += 1;
    }
    return !untilBrace;
  }

  return skipCode(false) ? chars.join("") : null;
}
