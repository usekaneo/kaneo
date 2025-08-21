export function formatTaskDescription(payload: {
  number: number;
  body: string | null;
  html_url: string;
  user: { login: string } | null;
  repository: {
    full_name: string;
  };
}): string {
  const issueUrl = payload.html_url;
  const body = payload.body || "No description provided";

  return `${body}

---
*Created from GitHub issue: ${issueUrl}*`;
}
