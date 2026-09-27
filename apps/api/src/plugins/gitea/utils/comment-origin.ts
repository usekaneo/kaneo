// Persist the origin in Gitea so delayed webhooks and later imports also skip echoes.
const KANEO_COMMENT_MARKER = "<!-- kaneo:comment -->";

export function markKaneoComment(body: string): string {
  return `${body}\n\n${KANEO_COMMENT_MARKER}`;
}

export function isKaneoComment(body: string): boolean {
  return body.trimEnd().endsWith(KANEO_COMMENT_MARKER);
}
