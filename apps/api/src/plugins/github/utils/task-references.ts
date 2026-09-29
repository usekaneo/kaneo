const taskLinkPattern = /\/project\/([\w-]+)\/task\/([\w-]+)/g;

export function extractTaskIdsFromLinks(
  projectId: string,
  ...texts: (string | null | undefined)[]
): string[] {
  const ids = new Set<string>();
  for (const text of texts) {
    for (const match of (text ?? "").matchAll(taskLinkPattern)) {
      if (match[1] === projectId && match[2]) ids.add(match[2]);
    }
  }
  return [...ids];
}
