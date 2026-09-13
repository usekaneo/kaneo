// formatIssueBody appends a `Task: <id>` footer to every description Kaneo
// writes to GitLab. Reading that body back into the task unchanged would keep
// the footer there, and the next edit in Kaneo would append a second one.
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
