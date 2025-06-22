export function formatTaskDescription(payload: {
  number: number;
  body: string | null;
  html_url: string;
  user: { login: string } | null;
  repository: {
    full_name: string;
  };
}): string {
  return `${payload.body || "No description provided"}`;
}
