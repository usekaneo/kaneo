export type GitlabWebhookProject = {
  id?: number;
  name?: string;
  web_url?: string;
  path_with_namespace?: string;
};

export type GitlabWebhookUser = {
  name?: string;
  username?: string;
  avatar_url?: string | null;
};

/** GitLab webhook payloads name a label's text `title`, not `name`. */
export type GitlabWebhookLabel = {
  id?: number;
  title?: string;
  color?: string;
};

export function webhookLabelNames(
  labels: GitlabWebhookLabel[] | undefined,
): string[] {
  if (!labels) return [];
  return labels
    .map((label) => label.title)
    .filter((title): title is string => Boolean(title));
}
