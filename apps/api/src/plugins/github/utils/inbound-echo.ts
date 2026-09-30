import { updateExternalLink } from "../services/link-manager";
import {
  ambiguousOutboundEcho,
  isOutboundEcho,
  pendingOutboundIntent,
  uncertainOutboundIntent,
  inboundOccurredAfterIntent,
  type SyncStamp,
} from "./sync-echo";
class ConfirmationRequired extends Error {}
class RepairRequired extends Error {}
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
  context?: {
    linkId: string;
    field: "title" | "description" | "state";
    localValue?: string;
  },
) {
  const version = Date.parse(updatedAt ?? "");
  const inboundVersion = Date.parse(stamp?.inboundUpdatedAt ?? "");
  const knownVersions = [
    inboundVersion,
    ...(stamp?.outbound ?? [])
      .filter((entry) => !entry.cancelled && !entry.pending && !entry.uncertain)
      .map((entry) => Date.parse(entry.updatedAt ?? "")),
  ].filter(Number.isFinite);
  if (
    Number.isFinite(version) &&
    knownVersions.some((known) => known > version)
  )
    return true;
  if (
    Number.isFinite(version) &&
    version === inboundVersion &&
    stamp?.inboundValue !== value
  ) {
    if (providerValue === undefined) throw new ConfirmationRequired();
    if (providerValue !== value) return true;
  }
  const uncertain = uncertainOutboundIntent(stamp, value);
  const localValue = context?.localValue ?? stamp?.value;
  if (
    uncertain &&
    localValue !== value &&
    !(
      stamp?.source !== "kaneo" &&
      stamp?.inboundValue === localValue &&
      inboundOccurredAfterIntent(stamp, uncertain)
    )
  ) {
    if (providerValue === undefined) throw new ConfirmationRequired();
    if (providerValue !== value) return true;
    throw new RepairRequired();
  }
  const pending = pendingOutboundIntent(stamp, value);
  if (pending) throw new PendingEcho(pending.intentId, updatedAt, context);
  if (!isOutboundEcho(stamp, value, updatedAt)) {
    const colliding =
      updatedAt &&
      stamp?.outbound?.some(
        (entry) => !entry.cancelled && entry.updatedAt === updatedAt,
      );
    if (!colliding) return false;
    if (providerValue === undefined) throw new ConfirmationRequired();
    return providerValue !== value;
  }
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
  defer?: () => Promise<void>,
): Promise<Result | undefined> {
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
      if (error instanceof RepairRequired) {
        if (!defer)
          throw new PendingResponseTimeout(
            "Uncertain outbound write needs durable repair",
          );
        try {
          await defer();
          return;
        } catch (cause) {
          throw new PendingResponseTimeout(
            "Could not persist deferred webhook delivery",
            { cause },
          );
        }
      } else if (error instanceof PendingEcho) {
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
        if (Date.now() >= deadline) {
          if (defer) {
            try {
              await defer();
              return;
            } catch (cause) {
              throw new PendingResponseTimeout(
                "Could not persist deferred webhook delivery",
                { cause },
              );
            }
          }
          throw new PendingResponseTimeout(
            "Outbound response is still pending; retry this webhook delivery",
          );
        }
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(delay, deadline - Date.now())),
        );
        delay = Math.min(delay * 2, 1000);
        current = undefined;
      } else if (
        error instanceof ConfirmationRequired &&
        current === undefined
      ) {
        try {
          current = await read();
        } catch (error) {
          if (!defer) throw error;
          try {
            await defer();
            return;
          } catch (cause) {
            throw new PendingResponseTimeout(
              "Could not persist deferred webhook delivery",
              { cause },
            );
          }
        }
      } else {
        throw error;
      }
    }
  }
}
