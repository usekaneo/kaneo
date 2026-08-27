// GitHub's own issue-closing keywords. A commit or PR body containing one of
// these followed by an issue reference closes that issue when it lands on the
// default branch. Kaneo reuses the same vocabulary so it can react to the same
// intent on any branch (including feature branches), not just the default one.
const CLOSE_KEYWORD_PATTERN =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b[\s:]+#(\d+)/gi;

/**
 * Extract the issue numbers a commit message asks to close, e.g. "fixes #12"
 * or "Closes #3, closes #4". Returns unique numbers in first-seen order.
 */
export function extractClosedIssueNumbers(message: string): number[] {
  if (!message) {
    return [];
  }

  const seen = new Set<number>();
  for (const match of message.matchAll(CLOSE_KEYWORD_PATTERN)) {
    const captured = match[1];
    if (!captured) {
      continue;
    }
    const num = Number.parseInt(captured, 10);
    if (!Number.isNaN(num)) {
      seen.add(num);
    }
  }

  return [...seen];
}

/** Collect the closed-issue references across every commit in a push. */
export function extractClosedIssueNumbersFromCommits(
  commits: Array<{ message?: string | null }>,
): number[] {
  const seen = new Set<number>();
  for (const commit of commits) {
    if (!commit.message) {
      continue;
    }
    for (const num of extractClosedIssueNumbers(commit.message)) {
      seen.add(num);
    }
  }
  return [...seen];
}
