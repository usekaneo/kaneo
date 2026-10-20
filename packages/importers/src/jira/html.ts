import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { jiraRules } from "./html-rules.js";

export type HtmlToMarkdown = (html: string | null | undefined) => string;

export function createJiraHtmlToMarkdown(baseUrl: string): HtmlToMarkdown {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
  });
  service.use(gfm);
  for (const [name, rule] of jiraRules(originOf(baseUrl))) {
    service.addRule(name, rule);
  }

  return (html) => {
    if (!html?.trim()) return "";
    return service
      .turndown(html)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };
}

function originOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return "";
  }
}
