/**
 * Older task descriptions were saved as editor HTML. The web editor still reads it, but the
 * app's Markdown renderer shows tags as text, so such descriptions are converted for display.
 */
const legacyHtmlStart = /^\s*<(p|h[1-6]|ul|ol|blockquote|pre|div|table)\b/i;
const tagToken = /(<\/?[a-zA-Z][^>]*>)/;
const tagParts = /^<(\/?)([a-zA-Z][\w-]*)([^>]*)>$/;
const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const marks: Record<string, string> = {
  strong: "**",
  b: "**",
  em: "*",
  i: "*",
  s: "~~",
  del: "~~",
  strike: "~~",
};
const framed = new Set([
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "code",
  "pre",
  ...Object.keys(marks),
]);

type Frame = { tag: string; attrs: string; out: string; items: number };

export function isLegacyHtml(text: string): boolean {
  return legacyHtmlStart.test(text);
}

function decode(text: string): string {
  return text.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity[0] !== "#") return entities[entity.toLowerCase()] ?? match;
      const hex = entity[1] === "x" || entity[1] === "X";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    },
  );
}

/** Keeps text literal, as the web shows it, instead of letting it read as Markdown. */
function escapeText(text: string): string {
  return text
    .replace(/[\\`*_[\]<>#~|+-]/g, "\\$&")
    .replace(/(\d)([.)])/g, "$1\\$2");
}

function attr(raw: string, name: string): string | undefined {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i",
  ).exec(raw);
  return match ? decode(match[1] ?? match[2]) : undefined;
}

function longestBackticks(text: string): number {
  return Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
}

function finish(frame: Frame, parent: Frame): string {
  const body = frame.out.trim();
  switch (frame.tag) {
    case "li": {
      parent.items += 1;
      const start = Number(attr(parent.attrs, "start") ?? "1");
      const marker =
        parent.tag === "ol"
          ? `${(Number.isFinite(start) ? start : 1) + parent.items - 1}. `
          : "- ";
      const checkbox =
        attr(frame.attrs, "data-type") === "taskItem"
          ? attr(frame.attrs, "data-checked") === "true"
            ? "[x] "
            : "[ ] "
          : "";
      const indent = " ".repeat(marker.length);
      const content = body
        .replace(/\n{2,}/g, "\n")
        .replace(/\n/g, `\n${indent}`);
      return `${marker}${checkbox}${content}\n`;
    }
    case "ul":
    case "ol":
      return parent.tag === "li" ? `\n${frame.out}` : `${frame.out}\n`;
    case "blockquote":
      return `${body
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n")}\n\n`;
    case "pre": {
      const fence = "`".repeat(Math.max(3, longestBackticks(frame.out) + 1));
      return `${fence}\n${frame.out.replace(/\n$/, "")}\n${fence}\n\n`;
    }
    case "code": {
      const fence = "`".repeat(longestBackticks(frame.out) + 1);
      const pad = /^`|`$/.test(frame.out) ? " " : "";
      return frame.out ? `${fence}${pad}${frame.out}${pad}${fence}` : "";
    }
    default: {
      const mark = marks[frame.tag];
      if (mark) {
        // Markdown ignores delimiters next to inner spaces, so keep spaces outside.
        const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(
          frame.out,
        ) as RegExpExecArray;
        return core ? `${lead}${mark}${core}${mark}${trail}` : frame.out;
      }
      const href = attr(frame.attrs, "href");
      return href ? `[${frame.out}](${href})` : frame.out;
    }
  }
}

/** Converts editor HTML to Markdown, keeping `img` and `kaneo-*` tags for the display rewrite. */
export function legacyHtmlToMarkdown(html: string): string {
  const stack: Frame[] = [{ tag: "", attrs: "", out: "", items: 0 }];
  const top = () => stack[stack.length - 1];
  const emit = (text: string) => {
    top().out += text;
  };
  let pre = 0;

  for (const token of html.split(tagToken)) {
    const tag = tagParts.exec(token);
    if (!tag) {
      if (pre) emit(decode(token));
      else if (token.trim()) {
        const text = decode(token.replace(/\s+/g, " "));
        const inCode = stack.some((frame) => frame.tag === "code");
        emit(inCode ? text : escapeText(text));
      } else if (token && !/\s$/.test(top().out)) emit(" ");
      continue;
    }

    const [, closing, rawName, rawAttrs] = tag;
    const name = rawName.toLowerCase();
    if (name === "img" || name.startsWith("kaneo-")) {
      emit(token);
    } else if (name === "code" && pre) {
      continue;
    } else if (framed.has(name)) {
      if (name === "pre") pre = Math.max(0, pre + (closing ? -1 : 1));
      if (!closing) {
        stack.push({ tag: name, attrs: rawAttrs, out: "", items: 0 });
      } else if (stack.some((frame, i) => i > 0 && frame.tag === name)) {
        let frame: Frame;
        do {
          frame = stack.pop() as Frame;
          top().out += finish(frame, top());
        } while (frame.tag !== name);
      }
    } else if (/^h[1-6]$/.test(name)) {
      emit(closing ? "\n\n" : `${"#".repeat(Number(name[1]))} `);
    } else if (name === "br") {
      emit("  \n");
    } else if (name === "hr") {
      emit("\n\n---\n\n");
    } else if (closing && (name === "p" || name === "div" || name === "tr")) {
      emit("\n\n");
    }
  }

  while (stack.length > 1) {
    const frame = stack.pop() as Frame;
    top().out += finish(frame, top());
  }
  return top()
    .out.replace(/[ \t]+\n\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
