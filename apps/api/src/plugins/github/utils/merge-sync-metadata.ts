import {
  boundOutboundHistory,
  type OutboundEntry,
  type SyncStamp,
} from "./sync-echo";
type SyncMetadata = Record<string, unknown> & {
  lastSync?: Record<string, SyncStamp>;
};

const historyOf = (stamp: SyncStamp | undefined) =>
  Array.isArray(stamp?.outbound)
    ? stamp.outbound.filter(
        (entry) =>
          typeof entry?.hash === "string" &&
          typeof entry?.timestamp === "string",
      )
    : [];

export function mergeSyncMetadata(
  current: SyncMetadata,
  incoming: SyncMetadata,
): SyncMetadata {
  const lastSync = { ...current.lastSync, ...incoming.lastSync };
  for (const [field, stamp] of Object.entries(lastSync)) {
    const history = [
      ...historyOf(current.lastSync?.[field]),
      ...historyOf(incoming.lastSync?.[field]),
    ];
    const prior = current.lastSync?.[field];
    const priorTime = Date.parse(prior?.timestamp ?? "");
    const incomingTime = Date.parse(stamp?.timestamp ?? "");
    const latest =
      Number.isFinite(priorTime) &&
      (!Number.isFinite(incomingTime) || priorTime > incomingTime)
        ? prior
        : stamp;
    lastSync[field] = latest ?? stamp;
    if (history.length)
      lastSync[field] = {
        ...latest,
        outbound: boundOutboundHistory([
          ...history
            .reduce((entries, entry) => {
              const key = entry.intentId ?? JSON.stringify(entry);
              const prior = entries.get(key);
              if (
                !prior ||
                entry.timestamp > prior.timestamp ||
                (entry.timestamp === prior.timestamp &&
                  prior.pending &&
                  !entry.pending)
              )
                entries.set(key, entry);
              return entries;
            }, new Map<string, OutboundEntry>())
            .values(),
        ]),
      };
  }
  return {
    ...current,
    ...incoming,
    ...(Object.keys(lastSync).length ? { lastSync } : {}),
  };
}
