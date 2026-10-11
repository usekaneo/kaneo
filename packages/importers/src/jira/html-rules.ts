import type TurndownService from "turndown";
import { emoticonText } from "./emoticons.js";

type Rule = TurndownService.Rule;

const CODE_LANGUAGE = /(?:^|\s)code-([\w+#-]+)/;

export function jiraRules(origin: string): Array<[string, Rule]> {
  return [
    ["jiraParagraph", { filter: "p", replacement: paragraph }],
    ["jiraListItem", { filter: "li", replacement: listItem }],
    ["jiraCodeBlock", { filter: isBareCodeBlock, replacement: codeBlock }],
    ["jiraMonospace", { filter: isMonospace, replacement: monospace }],
    ["jiraPanel", { filter: isPanel, replacement: blockquote }],
    ["jiraIcon", { filter: isIcon, replacement: () => "" }],
    ["jiraImage", { filter: "img", replacement: image }],
    ["jiraLink", { filter: isLink, replacement: link(origin) }],
    ["jiraMention", { filter: isMention, replacement: mention }],
    ["jiraTable", { filter: isHeaderlessTable, replacement: headerlessTable }],
  ];
}

function classes(node: HTMLElement): string[] {
  return (node.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function paragraph(content: string, node: HTMLElement): string {
  const parent = node.parentNode?.nodeName;
  if (parent === "TH" || parent === "TD") {
    return node.previousElementSibling ? ` ${content}` : content;
  }
  if (parent === "LI" && !node.previousElementSibling) {
    return `\n${content}\n`;
  }
  return `\n\n${content}\n\n`;
}

function listItem(content: string, node: HTMLElement): string {
  const parent = node.parentNode as HTMLElement | null;
  let marker = "- ";
  if (parent?.nodeName === "OL") {
    const start = Number(parent.getAttribute("start") ?? "1");
    const index = Array.prototype.indexOf.call(parent.children, node);
    marker = `${(Number.isFinite(start) ? start : 1) + index}. `;
  }
  const indent = " ".repeat(marker.length);
  const body = content
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
    .replace(/\n(?=[^\n])/g, `\n${indent}`);
  return `${marker}${body}${node.nextSibling ? "\n" : ""}`;
}

function isBareCodeBlock(node: HTMLElement): boolean {
  return node.nodeName === "PRE" && node.firstChild?.nodeName !== "CODE";
}

function codeBlock(_content: string, node: HTMLElement): string {
  const language = CODE_LANGUAGE.exec(node.getAttribute("class") ?? "")?.[1];
  const code = (node.textContent ?? "").replace(/\n+$/, "");
  const longestRun = Math.max(
    2,
    ...[...code.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const fence = "`".repeat(longestRun + 1);
  const info = language && language !== "none" ? language : "";
  return `\n\n${fence}${info}\n${code}\n${fence}\n\n`;
}

function isMonospace(node: HTMLElement): boolean {
  return node.nodeName === "TT";
}

function monospace(_content: string, node: HTMLElement): string {
  const text = node.textContent ?? "";
  if (!text) return "";
  const fence = text.includes("`") ? "``" : "`";
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

function isPanel(node: HTMLElement): boolean {
  if (node.nodeName !== "DIV") return false;
  const names = classes(node);
  if (names.includes("aui-message")) return true;
  return (
    names.includes("panel") &&
    !names.includes("code") &&
    !names.includes("preformatted")
  );
}

function blockquote(content: string): string {
  const body = content.replace(/^\n+|\n+$/g, "");
  return body ? `\n\n${body.replace(/^/gm, "> ")}\n\n` : "";
}

function isIcon(node: HTMLElement): boolean {
  return (
    node.nodeName === "SPAN" &&
    classes(node).some((name) => name.startsWith("aui-icon"))
  );
}

function image(_content: string, node: HTMLElement): string {
  const src = (node.getAttribute("src") ?? "").trim();
  const alt = (node.getAttribute("alt") ?? "").replace(/\s+/g, " ").trim();
  if (classes(node).includes("emoticon")) return emoticonText(src, alt);
  if (!/^https?:\/\//i.test(src)) return alt;
  return `![${alt.replace(/[[\]]/g, "\\$&")}](${escapeUrl(src)})`;
}

function isLink(node: HTMLElement): boolean {
  return node.nodeName === "A" && Boolean(node.getAttribute("href"));
}

function link(origin: string) {
  return (content: string, node: HTMLElement): string => {
    const href = resolveHref(node.getAttribute("href") ?? "", origin);
    const text = content.trim();
    if (!href || !text) return text;
    return `[${text}](${escapeUrl(href)})`;
  };
}

function resolveHref(raw: string, origin: string): string | undefined {
  const href = raw.trim();
  if (/^(?:https?:|mailto:)/i.test(href)) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return `${origin}${href}`;
  return undefined;
}

function escapeUrl(url: string): string {
  return url.replace(/[()\s]/g, (char) =>
    char === "(" ? "%28" : char === ")" ? "%29" : "%20",
  );
}

function isMention(node: HTMLElement): boolean {
  if (node.nodeName !== "A") return false;
  if (classes(node).includes("user-hover")) return true;
  if (node.hasAttribute("data-account-id") || node.hasAttribute("accountid")) {
    return true;
  }
  return /ViewProfile\.jspa/i.test(node.getAttribute("href") ?? "");
}

function mention(content: string): string {
  const name = content.trim();
  if (!name) return "";
  return name.startsWith("@") ? name : `@${name}`;
}

function isHeaderlessTable(node: HTMLElement): boolean {
  if (node.nodeName !== "TABLE") return false;
  const first = (node as HTMLTableElement).rows[0];
  return first !== undefined && !isHeadingRow(first);
}

function headerlessTable(content: string, node: HTMLElement): string {
  const lines = content.split("\n").filter((line) => line.trim());
  const first = (node as HTMLTableElement).rows[0];
  const width = first?.cells.length ?? 0;
  if (lines.length === 0 || width === 0) return "";
  const separator = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
  return `\n\n${[lines[0], separator, ...lines.slice(1)].join("\n")}\n\n`;
}

function isHeadingRow(row: HTMLTableRowElement): boolean {
  const parent = row.parentNode as HTMLElement | null;
  if (!parent) return false;
  if (parent.nodeName === "THEAD") return true;
  if (parent.firstChild !== row) return false;
  const section =
    parent.nodeName === "TABLE" ||
    (parent.nodeName === "TBODY" && isFirstBody(parent));
  return (
    section &&
    Array.prototype.every.call(
      row.childNodes,
      (cell: Node) => cell.nodeName === "TH",
    )
  );
}

function isFirstBody(body: HTMLElement): boolean {
  const previous = body.previousSibling;
  return (
    !previous ||
    (previous.nodeName === "THEAD" && !(previous.textContent ?? "").trim())
  );
}
