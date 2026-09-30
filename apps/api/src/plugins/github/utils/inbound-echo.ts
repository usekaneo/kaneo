import { updateExternalLink } from "../services/link-manager";
import {
  ambiguousOutboundEcho,
  isOutboundEcho,
  pendingOutboundIntent,
  type SyncStamp,
} from "./sync-echo";
class ConfirmationRequired extends Error {}
export class PendingResponseTimeout extends Error {}
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
  if (stamp?.value === value && !ambiguousOutboundEcho(stamp, value, updatedAt))
    return true;
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
  let delay = 50;
  const deadline = Date.now() + 5000;
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
        if (Date.now() >= deadline)
          throw new PendingResponseTimeout(
            "Outbound response is still pending; retry this webhook delivery",
          );
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(delay, deadline - Date.now())),
        );
        delay = Math.min(delay * 2, 1000);
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
