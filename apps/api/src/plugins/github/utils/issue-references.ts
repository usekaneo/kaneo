function issueNumber(reference: string, repository: URL): string | null {
  const short = reference.match(/^(?:([\w.-]+\/[\w.-]+))?#(\d+)$/);
  if (short) {
    const repositoryName = repository.pathname
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join("/");
    if (short[1] && short[1].toLowerCase() !== repositoryName.toLowerCase())
      return null;
    return short[2] ?? null;
  }

  try {
    const url = new URL(reference.replace(/[.,;:)]+$/, ""));
    const repositoryPath = repository.pathname.replace(/\/$/, "");
    if (url.origin !== repository.origin) return null;
    const prefix = `${repositoryPath}/issues/`;
    if (!url.pathname.toLowerCase().startsWith(prefix.toLowerCase()))
      return null;
    const number = url.pathname.slice(prefix.length);
    return /^\d+$/.test(number) ? number : null;
  } catch {
    return null;
  }
}

export function extractIssueReferences(
  title: string,
  body: string | null,
  repositoryUrl: string,
): string[] {
  const repository = new URL(repositoryUrl);
  const reference = "(?:https?://[^\\s<>]+|(?:[\\w.-]+/[\\w.-]+)?#\\d+)";
  const titlePattern = new RegExp(
    `(?:^|[\\s(\\[])(${reference})(?=$|[\\s)\\].,;:])`,
    "gi",
  );
  const bodyPattern = new RegExp(
    `\\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\\b\\s*:?\\s*(${reference})(?=$|[\\s)\\].,;:])`,
    "gi",
  );
  const numbers = new Set<string>();
  for (const match of [
    ...title.matchAll(titlePattern),
    ...(body ?? "").matchAll(bodyPattern),
  ]) {
    if (!match[1]) continue;
    const number = issueNumber(match[1], repository);
    if (number !== null) numbers.add(number);
  }
  return [...numbers];
}
