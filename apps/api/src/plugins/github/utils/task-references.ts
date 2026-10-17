const taskLinkPattern =
  /\/dashboard\/workspace\/[\w-]+\/project\/([\w-]+)\/task\/([\w-]+)(?![\w-])/g;

export function extractTaskLinks(...texts: (string | null | undefined)[]) {
  const links = new Map<string, { projectId: string; taskId: string }>();
  for (const text of texts) {
    for (const [, projectId, taskId] of (text ?? "").matchAll(
      taskLinkPattern,
    )) {
      if (projectId && taskId) links.set(taskId, { projectId, taskId });
    }
  }
  return [...links.values()];
}
