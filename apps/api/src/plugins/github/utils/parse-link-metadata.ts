// An external link's metadata is a JSON string in the database, so a row
// written by an older version, or truncated, is not the caller's fault and
// should not take the webhook delivery down with it. The Gitea handlers already
// warn and carry on with an empty object; this is the same behaviour in one
// place, since the GitHub side needs it in four.
// The shape is whatever an earlier write left behind, so callers that read
// named fields say what they expect. The default keeps the untyped reading for
// the handlers that only spread the value forward.
export function parseLinkMetadata<T extends object = Record<string, unknown>>(
  raw: string | null | undefined,
  context: { externalLinkId: string; source: string },
): Partial<T> {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Partial<T>;
  } catch (error) {
    console.warn("Failed to parse GitHub external link metadata", {
      ...context,
      metadata: raw,
      error,
    });

    return {};
  }
}
