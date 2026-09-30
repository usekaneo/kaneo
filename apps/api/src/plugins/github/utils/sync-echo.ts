import { createHash } from "node:crypto";

export type OutboundIntent = {
  intentId?: string;
  pending?: boolean;
  cancelled?: boolean;
  uncertain?: boolean;
  observedUpdatedAt?: string;
  startedAt?: string;
  ambiguous?: boolean;
};
export type OutboundEntry = OutboundIntent & {
  hash: string;
  timestamp: string;
  updatedAt?: string;
};
export type SyncStamp = {
  timestamp?: string;
  source?: string;
  value?: string;
  inboundAt?: string;
  inboundValue?: string;
  outbound?: OutboundEntry[];
};

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function outboundStamp(
  previous: SyncStamp | undefined,
  value: string,
  updatedAt?: string,
  intent: OutboundIntent = {},
): SyncStamp {
  const timestamp = new Date().toISOString();
  const outbound = (previous?.outbound ?? []).filter(
    (entry) => !intent.intentId || entry.intentId !== intent.intentId,
  );
  // Older installations have only the last value, without a provider timestamp.
  if (
    previous?.source === "kaneo" &&
    !previous.outbound?.length &&
    previous.value !== undefined &&
    previous.timestamp
  )
    outbound.push({
      hash: hash(previous.value),
      timestamp: previous.timestamp,
    });
  const previousIntent = previous?.outbound?.find(
    (entry) => intent.intentId && entry.intentId === intent.intentId,
  );
  outbound.push({
    hash: hash(value),
    timestamp,
    updatedAt,
    observedUpdatedAt: previousIntent?.observedUpdatedAt,
    startedAt:
      previousIntent?.startedAt ?? (intent.pending ? timestamp : undefined),
    ambiguous:
      previousIntent?.ambiguous ||
      !!(
        updatedAt &&
        previousIntent?.observedUpdatedAt === updatedAt &&
        previous?.inboundAt &&
        previousIntent.startedAt &&
        previous.inboundAt >= previousIntent.startedAt &&
        previous.inboundValue !== value
      ),
    ...intent,
  });
  const bounded = boundOutboundHistory(outbound);
  if (intent.pending || intent.cancelled || intent.uncertain)
    return { ...previous, outbound: bounded };
  return { ...previous, timestamp, source: "kaneo", value, outbound: bounded };
}

export function boundOutboundHistory(entries: OutboundEntry[]) {
  // Keep active intents until they settle; completed history stays bounded.
  const recent = entries
    .map((entry) =>
      entry.pending && Date.now() - Date.parse(entry.timestamp) >= 300_000
        ? { ...entry, pending: false, uncertain: true }
        : entry,
    )
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const completed = recent.filter((entry) => !entry.pending).slice(-32);
  return [...completed, ...recent.filter((entry) => entry.pending)].sort(
    (left, right) => left.timestamp.localeCompare(right.timestamp),
  );
}

export function pendingOutboundIntent(
  stamp: SyncStamp | undefined,
  value: string,
) {
  return (stamp?.outbound ?? []).find(
    (entry) =>
      entry.pending &&
      !entry.cancelled &&
      entry.hash === hash(value) &&
      Date.now() - Date.parse(entry.timestamp) < 300_000,
  );
}

export function isPendingOutboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
) {
  return !!pendingOutboundIntent(stamp, value);
}

export function isOutboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
  updatedAt?: string,
): boolean {
  if (!stamp) return false;
  const entries = stamp.outbound ?? [];
  const valueHash = hash(value);
  if (
    entries.some(
      (entry) =>
        !entry.cancelled &&
        entry.hash === valueHash &&
        (entry.updatedAt && updatedAt
          ? entry.updatedAt === updatedAt
          : Date.now() - Date.parse(entry.timestamp) < 300_000),
    )
  )
    return true;
  // Preserve compatibility with stamps written before outbound history existed.
  return (
    entries.length === 0 && stamp.source === "kaneo" && stamp.value === value
  );
}

/** Provider timestamps can collide; historical values need current-provider confirmation. */
export async function confirmedOutboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
  updatedAt: string | undefined,
  readCurrent: () => Promise<string>,
) {
  if (isPendingOutboundEcho(stamp, value)) return true;
  if (!isOutboundEcho(stamp, value, updatedAt)) return false;
  if (stamp?.value === value) return true;
  return (await readCurrent()) !== value;
}

export function inboundStamp(
  previous: SyncStamp | undefined,
  value: string,
  source: string,
): SyncStamp {
  const timestamp = new Date().toISOString();
  return {
    ...previous,
    timestamp,
    source,
    value,
    inboundAt: timestamp,
    inboundValue: value,
  };
}
export function ambiguousOutboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
  updatedAt?: string,
) {
  return (
    stamp?.outbound?.some(
      (entry) =>
        entry.ambiguous &&
        entry.hash === hash(value) &&
        entry.updatedAt === updatedAt,
    ) ?? false
  );
}
export function hasNewerObservedEdit(
  entry: OutboundEntry | undefined,
  updatedAt: string | undefined,
) {
  if (!updatedAt || !entry?.observedUpdatedAt) return false;
  return (
    Date.parse(entry.observedUpdatedAt) > Date.parse(updatedAt) ||
    (entry.observedUpdatedAt === updatedAt && !!entry.ambiguous)
  );
}

export function uncertainOutboundIntent(
  stamp: SyncStamp | undefined,
  value: string,
) {
  return stamp?.outbound?.find(
    (entry) =>
      !entry.cancelled &&
      entry.hash === hash(value) &&
      (entry.uncertain ||
        (entry.pending && Date.now() - Date.parse(entry.timestamp) >= 300_000)),
  );
}
