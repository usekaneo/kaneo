export function formatGitHubComment({
  template,
  id,
  priority,
  status,
  title,
}: {
  template: string;
  id: string;
  priority: string;
  status: string;
  title: string;
}) {
  return template
    .replace("{taskId}", id)
    .replace("{priority}", priority)
    .replace("{status}", status)
    .replace("{title}", title);
}
