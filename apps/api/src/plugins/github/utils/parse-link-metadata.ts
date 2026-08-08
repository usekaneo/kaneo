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

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to parse GitHub external link metadata", {
      ...context,
      error,
    });

    return {};
  }

  // Parsing succeeding is not the same as the row holding metadata. The
  // literal `null` parses to `null`, `"kaneo"` to a string, and either would
  // pass the return type on to a caller that reads a named field off it, which
  // is the crash this helper exists to prevent. An array is not what any writer
  // here produces either, and spreading one forward would turn its indices into
  // keys. Both take the same exit as a row that will not parse.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.warn(
      "Ignoring GitHub external link metadata that is not an object",
      {
        ...context,
        metadataType: parsed === null ? "null" : typeof parsed,
      },
    );

    return {};
  }

  return parsed as Partial<T>;
}
