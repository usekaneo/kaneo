export function formatTaskDescription(payload: {
  number: number;
  body: string | null;
  html_url: string;
  user: { login: string } | null;
  repository: {
    full_name: string;
  };
}): string {
  return `**Created from GitHub issue #${payload.number}**

${payload.body || "No description provided"}

---
**GitHub Details:**
- Repository: ${payload.repository.full_name}
- Issue URL: ${payload.html_url}
- Created by: ${payload.user?.login || "unknown"}
- GitHub Issue #${payload.number}`;
}
