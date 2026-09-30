import { isOutboundEcho, type SyncStamp } from "./sync-echo";
class ConfirmationRequired extends Error {}

export function inboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
  updatedAt?: string,
  providerValue?: string,
) {
  if (!isOutboundEcho(stamp, value, updatedAt)) return false;
  if (stamp?.value === value) return true;
  if (providerValue === undefined) throw new ConfirmationRequired();
  return providerValue !== value;
}

// Release the guarded transaction before an ambiguous echo needs provider I/O.
export async function withEchoConfirmation<Provider, Result>(
  read: () => Promise<Provider>,
  apply: (current?: Provider) => Promise<Result>,
): Promise<Result> {
  try {
    return await apply();
  } catch (error) {
    if (!(error instanceof ConfirmationRequired)) throw error;
    return apply(await read());
  }
}
