// Strip the `Task:` footer Kaneo appends, or every sync adds another one.
const FOOTER = /(?:\r?\n)*-{3}\r?\n<sub>Task: [^<\r\n]+<\/sub>\s*$/;
const FOOTER_ONLY = /^\s*<sub>Task: [^<\r\n]+<\/sub>\s*$/;

export function taskDescriptionFromIssue(body: string | null): string {
  if (!body) {
    return "";
  }

  if (FOOTER_ONLY.test(body)) {
    return "";
  }

  return body.replace(FOOTER, "");
}
