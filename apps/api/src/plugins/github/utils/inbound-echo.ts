import { updateExternalLink } from "../services/link-manager";
import {
  isOutboundEcho,
  pendingOutboundIntent,
  type SyncStamp,
} from "./sync-echo";
class ConfirmationRequired extends Error {}
export class PendingEcho extends Error {
  recorded = false;
  constructor(
    public intentId: string | undefined,
    public updatedAt: string | undefined,
    public context?: {
      linkId: string;
      field: "title" | "description" | "state";
    },
  ) {
    super("Outbound response is pending");
  }
}
export function inboundEcho(
  stamp: SyncStamp | undefined,
  value: string,
  updatedAt?: string,
  providerValue?: string,
  context?: { linkId: string; field: "title" | "description" | "state" },
) {
  const pending = pendingOutboundIntent(stamp, value);
  if (pending) throw new PendingEcho(pending.intentId, updatedAt, context);
  if (!isOutboundEcho(stamp, value, updatedAt)) return false;
  if (stamp?.value === value) return true;
  if (providerValue === undefined) throw new ConfirmationRequired();
  return providerValue !== value;
}
// Every retry releases the transaction first. Persist observed provider versions
// so an outbound completion cannot repair over a newer edit waiting for it.
export async function withEchoConfirmation<Provider, Result>(
  read: () => Promise<Provider>,
  apply: (current?: Provider) => Promise<Result>,
): Promise<Result> {
  const recorded = new Set<string>();
  let current: Provider | undefined;
  for (;;) {
    try {
      const result = await apply(current);
      if (result instanceof PendingEcho) throw result;
      return result;
    } catch (error) {
      if (error instanceof PendingEcho) {
        const { context, intentId, updatedAt } = error;
        const key = `${intentId}:${updatedAt}`;
        if (
          !error.recorded &&
          context &&
          intentId &&
          updatedAt &&
          !recorded.has(key)
        ) {
          await updateExternalLink(context.linkId, {
            observedOutbound: { field: context.field, intentId, updatedAt },
          });
          recorded.add(key);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        current = undefined;
      } else if (
        error instanceof ConfirmationRequired &&
        current === undefined
      ) {
        current = await read();
      } else {
        throw error;
      }
    }
  }
}
