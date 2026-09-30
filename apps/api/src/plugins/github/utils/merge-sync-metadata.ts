import type { SyncStamp } from "./sync-echo";
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
        outbound: [
          ...new Map(
            history.map((entry) => [JSON.stringify(entry), entry]),
          ).values(),
        ]
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .slice(-32),
      };
  }
  return {
    ...current,
    ...incoming,
    ...(Object.keys(lastSync).length ? { lastSync } : {}),
  };
}
