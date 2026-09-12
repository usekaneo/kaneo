export type LinkSyncState = {
  timestamp: string;
  source: string;
  value: string;
};

export type LinkMetadata = {
  lastSync?: {
    title?: LinkSyncState;
    description?: LinkSyncState;
  };
  [key: string]: unknown;
};

/**
 * How long an identical value still counts as the other side's echo. Generous
 * enough for a slow webhook delivery, short enough that setting a title back to
 * an older value tomorrow is treated as the real edit it is.
 */
export const TEXT_ECHO_WINDOW_MS = 60_000;

/**
 * A value one side writes comes straight back from the other as a webhook or an
 * event. The value itself is what identifies the echo -- suppressing anything
 * that merely arrives soon after a write would drop a real edit made right on
 * top of it -- and the window bounds how long that identity holds.
 */
export function isEchoOf(
  state: LinkSyncState | undefined,
  source: string,
  incoming: string,
): boolean {
  if (state?.source !== source || state.value !== incoming) {
    return false;
  }

  const writtenAt = Date.parse(state.timestamp);
  if (Number.isNaN(writtenAt)) {
    return false;
  }

  return Date.now() - writtenAt <= TEXT_ECHO_WINDOW_MS;
}

export function parseLinkSyncMetadata(
  raw: string | null | undefined,
  context: { externalLinkId: string; field: string },
): LinkMetadata {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    return parsed as LinkMetadata;
  } catch (error) {
    console.warn("Failed to parse GitLab external link metadata", {
      ...context,
      error,
    });
    return {};
  }
}

export function withLastSync(
  metadata: LinkMetadata,
  field: "title" | "description",
  source: string,
  value: string,
): LinkMetadata {
  return {
    ...metadata,
    lastSync: {
      ...(metadata.lastSync ?? {}),
      [field]: {
        timestamp: new Date().toISOString(),
        source,
        value,
      },
    },
  };
}
