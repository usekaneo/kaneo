const NUMBERED_PATH =
  /\/(?:pull|pulls|merge_requests|pull-requests)\/(\d+)(?:[/?#]|$)/i;

export function pullRequestNumber(url: string): string | null {
  return NUMBERED_PATH.exec(url)?.[1] ?? null;
}
