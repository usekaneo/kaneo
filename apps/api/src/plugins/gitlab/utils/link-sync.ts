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

/** How long an identical value still counts as an echo. */
export const TEXT_ECHO_WINDOW_MS = 60_000;

/** An echo is the value the other side last wrote, within the window. */
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
