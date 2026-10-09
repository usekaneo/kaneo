import { isSafeUrl } from "./sanitize.js";

export function hyperlink(text: string, url: string, enabled: boolean): string {
  if (!enabled || !text || !isSafeUrl(url)) return text;
  return `\u001b]8;;${url}\u001b\\${text}\u001b]8;;\u001b\\`;
}
