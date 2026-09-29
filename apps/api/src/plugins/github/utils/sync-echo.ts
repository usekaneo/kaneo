import { createHash } from "node:crypto";

export type SyncStamp = {
  timestamp?: string;
  source?: string;
  value?: string;
  outbound?: Array<{ hash: string; timestamp: string; updatedAt?: string }>;
};

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function outboundStamp(
  previous: SyncStamp | undefined,
  value: string,
  updatedAt?: string,
): SyncStamp {
  const timestamp = new Date().toISOString();
  const outbound = [...(previous?.outbound ?? [])];
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
  outbound.push({ hash: hash(value), timestamp, updatedAt });
  return { timestamp, source: "kaneo", value, outbound: outbound.slice(-32) };
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
  if (!isOutboundEcho(stamp, value, updatedAt)) return false;
  if (stamp?.value === value) return true;
  return (await readCurrent()) !== value;
}
