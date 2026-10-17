import { stringWidth, truncate } from "../render/width.js";

export type DescriptionLine = {
  readonly text: string;
  readonly kind: "text" | "heading" | "muted";
};

export type PlainDescription = {
  readonly lines: ReadonlyArray<DescriptionLine>;
  readonly truncated: boolean;
};

export type PlainDescriptionOptions = {
  readonly width: number;
  readonly unicode: boolean;
  readonly maxLines?: number;
};

const FENCE = /^\s*(`{3,}|~{3,})/u;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/u;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/u;
const QUOTE = /^\s{0,3}>\s?/u;
const LIST_ITEM =
  /^(\s*)([-*+]|\d{1,9}[.)]|[a-zA-Z][.)]|[ivxlcdmIVXLCDM]{1,8}[.)])\s+(.*)$/u;
const TASK_BOX = /^\[([ xX])\]\s+(.*)$/u;
const TABLE_DIVIDER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/u;
const HARD_BREAK = /(?:\\| {2,})$/u;
const HTML_TAGS =
  "a|abbr|b|big|blockquote|br|center|code|del|details|div|em|font|h[1-6]|hr|i|ins|kbd|li|mark|ol|p|pre|s|small|span|strike|strong|sub|summary|sup|table|tbody|td|tfoot|th|thead|tr|u|ul";
const KNOWN_TAG = new RegExp(`</?(?:${HTML_TAGS})(?:\\s[^<>]*)?/?>`, "giu");
const OPEN = String.fromCharCode(0xe000);
const CLOSE = String.fromCharCode(0xe001);
const PLACEHOLDER = new RegExp(`${OPEN}(\\d+)${CLOSE}`, "gu");
const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function attribute(tag: string, name: string): string {
  const match = new RegExp(`\\s${name}="([^"]*)"`, "u").exec(tag);
  return match?.[1] ?? "";
}

function codePoint(value: number, fallback: string): string {
  return Number.isInteger(value) && value > 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : fallback;
}

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+);/giu,
    (whole, name: string) => {
      if (/^#x/iu.test(name))
        return codePoint(Number.parseInt(name.slice(2), 16), whole);
      if (name.startsWith("#")) return codePoint(Number(name.slice(1)), whole);
      return ENTITIES[name.toLowerCase()] ?? whole;
    },
  );
}

export function inlineText(source: string): string {
  const kept: string[] = [];
  const keep = (value: string) => `${OPEN}${kept.push(value) - 1}${CLOSE}`;
  const linkText = (label: string, url: string) => {
    const target = keep(url.replace(/^mailto:/iu, ""));
    return label === "" || label === url || `mailto:${label}` === url
      ? target
      : `${label} (${target})`;
  };
  const text = source
    .replace(
      /\\([\p{P}\p{S}])|(`+)(.+?)\2/gu,
      (_, escaped?: string, _ticks?: string, code?: string) =>
        keep(escaped ?? code?.trim() ?? ""),
    )
    .replace(/<kaneo-mention\b[^>]*>(?:<\/kaneo-mention>)?/giu, (tag) =>
      keep(`@${decodeEntities(attribute(tag, "label"))}`),
    )
    .replace(/<kaneo-issue-link\b[^>]*>/giu, (tag) =>
      keep(
        decodeEntities(attribute(tag, "issue-key") || attribute(tag, "url")),
      ),
    )
    .replace(/<kaneo-embed\b[^>]*>/giu, (tag) =>
      keep(decodeEntities(attribute(tag, "url"))),
    )
    .replace(/<kaneo-attachment\b[^>]*>/giu, (tag) => {
      const name = decodeEntities(attribute(tag, "filename"));
      return keep(name ? `[attachment: ${name}]` : "[attachment]");
    })
    .replace(/<img\b[^>]*>/giu, (tag) => {
      const alt = decodeEntities(attribute(tag, "alt"));
      return keep(alt ? `[image: ${alt}]` : "[image]");
    })
    .replace(
      /!\[([^\]]*)\]\((?:<[^>]*>|[^)\s]*)(?:\s+"[^"]*")?\)/gu,
      (_, alt: string) => keep(alt ? `[image: ${alt}]` : "[image]"),
    )
    .replace(
      /\[([^\]]*)\]\((?:<([^>]*)>|([^)\s]*))(?:\s+"[^"]*")?\)/gu,
      (
        _,
        label: string,
        bracketed: string | undefined,
        bare: string | undefined,
      ) => linkText(label, bracketed ?? bare ?? ""),
    )
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/giu, (tag, label: string) =>
      linkText(label, decodeEntities(attribute(tag, "href"))),
    )
    .replace(/<((?:https?|mailto):[^\s<>]+)>/giu, (_, url: string) =>
      linkText("", url),
    )
    .replace(/<br\s*\/?>/giu, " ")
    .replace(KNOWN_TAG, "")
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/gu, "$1")
    .replace(/(^|[^\w])__(?=\S)(.+?)(?<=\S)__(?=[^\w]|$)/gu, "$1$2")
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/gu, "$1")
    .replace(/\+\+(?=\S)(.+?)(?<=\S)\+\+/gu, "$1")
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/gu, "$1")
    .replace(/(^|[^\w])_(?=\S)(.+?)(?<=\S)_(?=[^\w]|$)/gu, "$1$2");
  return decodeEntities(text).replace(
    PLACEHOLDER,
    (_, index: string) => kept[Number(index)] ?? "",
  );
}

function splitWord(word: string, width: number): string[] {
  const parts: string[] = [];
  let current = "";
  for (const character of word) {
    if (current !== "" && stringWidth(current + character) > width) {
      parts.push(current);
      current = "";
    }
    current += character;
  }
  if (current !== "") parts.push(current);
  return parts;
}

export function wrapText(
  text: string,
  width: number,
  firstPrefix = "",
  restPrefix = firstPrefix,
): string[] {
  const words = text.split(/\s+/u).filter((word) => word !== "");
  const lines: string[] = [];
  let line = firstPrefix;
  let empty = true;
  for (const word of words) {
    const prefix = empty ? line : `${line} `;
    if (stringWidth(prefix + word) <= width) {
      line = prefix + word;
      empty = false;
      continue;
    }
    if (!empty) {
      lines.push(line);
      line = restPrefix;
      empty = true;
    }
    const room = Math.max(1, width - stringWidth(line));
    const parts = stringWidth(word) > room ? splitWord(word, room) : [word];
    for (const [index, part] of parts.entries()) {
      if (index < parts.length - 1) {
        lines.push(line + part);
        line = restPrefix;
      } else {
        line += part;
      }
    }
    empty = false;
  }
  if (!empty) lines.push(line);
  return lines;
}

function tableCells(row: string): string[] {
  const trimmed = row
    .trim()
    .replace(/^\|/u, "")
    .replace(/(?<!\\)\|$/u, "");
  return trimmed.split(/(?<!\\)\|/u).map((cell) => inlineText(cell.trim()));
}

function renderTable(
  rows: ReadonlyArray<string>,
  width: number,
  ellipsis: string,
  rule: string,
) {
  const [head = "", , ...body] = rows;
  const cells = [tableCells(head), ...body.map(tableCells)];
  const count = Math.max(...cells.map((row) => row.length));
  const widths = Array.from({ length: count }, (_, column) =>
    Math.max(1, ...cells.map((row) => stringWidth(row[column] ?? ""))),
  );
  const line = (row: ReadonlyArray<string>) =>
    truncate(
      widths
        .map((columnWidth, column) => {
          const cell = row[column] ?? "";
          return (
            cell + " ".repeat(Math.max(0, columnWidth - stringWidth(cell)))
          );
        })
        .join("  ")
        .trimEnd(),
      width,
      ellipsis,
    );
  const [header = [], ...rest] = cells;
  return [
    { text: line(header), kind: "heading" as const },
    {
      text: truncate(
        widths.map((columnWidth) => rule.repeat(columnWidth)).join("  "),
        width,
        ellipsis,
      ),
      kind: "muted" as const,
    },
    ...rest.map((row) => ({ text: line(row), kind: "text" as const })),
  ];
}

function leadingIndent(line: string): string {
  const match = /^\s*/u.exec(line.replace(/\t/gu, "  "));
  return match?.[0] ?? "";
}

export function plainDescription(
  source: string,
  options: PlainDescriptionOptions,
): PlainDescription {
  const width = Math.max(20, options.width);
  const maxLines = options.maxLines ?? Number.POSITIVE_INFINITY;
  const bullet = options.unicode ? "•" : "-";
  const bar = options.unicode ? "│" : "|";
  const rule = options.unicode ? "─" : "-";
  const ellipsis = options.unicode ? "…" : "...";
  const lines: DescriptionLine[] = [];
  const blank = () => {
    if (lines.length > 0 && lines[lines.length - 1]?.text !== "") {
      lines.push({ text: "", kind: "text" });
    }
  };
  const push = (
    texts: ReadonlyArray<string>,
    kind: DescriptionLine["kind"],
  ) => {
    for (const text of texts) lines.push({ text, kind });
  };

  const sourceLines = source
    .replace(/\r\n?/gu, "\n")
    .replace(/<!--[\s\S]*?-->/gu, "")
    .split("\n");
  let fence: string | null = null;

  for (
    let index = 0;
    index < sourceLines.length && lines.length <= maxLines;
    index++
  ) {
    const raw = sourceLines[index] ?? "";
    if (fence !== null) {
      if (raw.trim().startsWith(fence)) {
        fence = null;
        continue;
      }
      push(
        [truncate(`  ${raw.replace(/\t/gu, "  ")}`.trimEnd(), width, ellipsis)],
        "text",
      );
      continue;
    }
    const fenceStart = FENCE.exec(raw);
    if (fenceStart) {
      fence = fenceStart[1] ?? "```";
      continue;
    }
    const line = raw.replace(HARD_BREAK, "").trimEnd();
    if (line.trim() === "") {
      blank();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blank();
      push(wrapText(inlineText(heading[2] ?? ""), width), "heading");
      continue;
    }
    if (RULE.test(line)) {
      push([rule.repeat(Math.min(width, 24))], "muted");
      continue;
    }
    const next = sourceLines[index + 1] ?? "";
    if (
      line.trim().startsWith("|") &&
      TABLE_DIVIDER.test(next) &&
      next.includes("-")
    ) {
      const rows = [line, next];
      index += 2;
      while (
        index < sourceLines.length &&
        (sourceLines[index] ?? "").trim().startsWith("|")
      ) {
        rows.push(sourceLines[index] ?? "");
        index += 1;
      }
      index -= 1;
      lines.push(...renderTable(rows, width, ellipsis, rule));
      continue;
    }
    if (QUOTE.test(line)) {
      let content = line;
      while (QUOTE.test(content)) content = content.replace(QUOTE, "");
      push(wrapText(inlineText(content), width, `${bar} `), "muted");
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const indent = leadingIndent(item[1] ?? "");
      const body = item[3] ?? "";
      const task = TASK_BOX.exec(body);
      const marker = task
        ? task[1] === " "
          ? "[ ]"
          : "[x]"
        : /^[-*+]$/u.test(item[2] ?? "")
          ? bullet
          : (item[2] ?? "");
      const text = inlineText(task ? (task[2] ?? "") : body);
      const hanging = `${indent}${" ".repeat(stringWidth(marker) + 1)}`;
      push(wrapText(text, width, `${indent}${marker} `, hanging), "text");
      continue;
    }
    const indent = leadingIndent(line);
    push(wrapText(inlineText(line.trim()), width, indent), "text");
  }

  while (lines.length > 0 && lines[lines.length - 1]?.text === "") lines.pop();
  const truncated = lines.length > maxLines;
  const shown = truncated ? lines.slice(0, maxLines) : lines;
  while (shown.length > 0 && shown[shown.length - 1]?.text === "") shown.pop();
  return { lines: shown, truncated };
}
