/** Webhooks send labels as objects keyed by `title`, unlike the REST API. */
export type GitlabWebhookProject = {
  name: string;
  web_url: string;
  path_with_namespace: string;
};

export type GitlabWebhookLabel = {
  title?: string;
  color?: string;
};

export type GitlabWebhookUser = {
  name?: string;
  username?: string;
  avatar_url?: string | null;
};

export function labelTitles(
  labels: GitlabWebhookLabel[] | undefined,
): string[] {
  if (!labels) return [];
  return labels
    .map((label) => label.title)
    .filter((title): title is string => Boolean(title));
}

export function labelColor(label: GitlabWebhookLabel): string {
  return label.color ? `#${label.color.replace(/^#/, "")}` : "#6B7280";
}
