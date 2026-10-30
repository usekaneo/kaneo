import { createHash } from "node:crypto";
import { updateExternalLink } from "../services/link-manager";
import {
  ambiguousOutboundEcho,
  isOutboundEcho,
  pendingOutboundIntent,
  uncertainOutboundIntents,
  inboundOccurredAfterIntent,
  type SyncStamp,
} from "./sync-echo";
type ConfirmationSnapshot = {
  fingerprint: string;
  localValueHash: string;
};
type EchoConfirmation = ReadonlyMap<string, ConfirmationSnapshot>;
class ConfirmationRequired extends Error {
  constructor(
    public key?: string,
    public snapshot?: ConfirmationSnapshot,
  ) {
    super("Current provider confirmation is required");
  }
}
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
    confirmation?: EchoConfirmation;
  },
) {
  const confirmedValue = () => {
    const key = context ? `${context.linkId}:${context.field}` : undefined;
    const localValueHash = createHash("sha256")
      .update(context?.localValue ?? stamp?.value ?? "")
      .digest("hex");
    const snapshot = key
      ? {
          fingerprint: createHash("sha256")
            .update(JSON.stringify({ stamp, localValueHash }))
            .digest("hex"),
          localValueHash,
        }
      : undefined;
    const previous = key ? context?.confirmation?.get(key) : undefined;
    // A newer local or provider edit owns reconciliation after the read began.
    if (
      providerValue !== undefined &&
      previous &&
      previous.localValueHash !== localValueHash
    )
      return undefined;
    if (
      providerValue === undefined ||
      (key &&
        context?.confirmation &&
        previous?.fingerprint !== snapshot?.fingerprint)
    )
      throw new ConfirmationRequired(key, snapshot);
    return providerValue;
  };
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
    if (confirmedValue() !== value) return true;
  }
  const uncertain = uncertainOutboundIntents(stamp, value);
  const localValue = context?.localValue ?? stamp?.value;
  if (
    localValue !== value &&
    uncertain.some(
      (entry) =>
        !(
          stamp?.source !== "kaneo" &&
          stamp?.inboundValue === localValue &&
          inboundOccurredAfterIntent(stamp, entry)
        ),
    )
  ) {
    if (confirmedValue() !== value) return true;
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
    return confirmedValue() !== value;
  }
  if (stamp?.value === value && !ambiguousOutboundEcho(stamp, value, updatedAt))
    return true;
  return confirmedValue() !== value;
}
// Every retry releases the transaction first. Persist observed provider versions
// so an outbound completion cannot repair over a newer edit waiting for it.
export async function withEchoConfirmation<Provider, Result>(
  read: () => Promise<Provider>,
  apply: (
    current?: Provider,
    confirmation?: EchoConfirmation,
  ) => Promise<Result>,
  defer?: () => Promise<void>,
): Promise<Result | undefined> {
  const recorded = new Set<string>();
  const confirmation = new Map<string, ConfirmationSnapshot>();
  let current: Provider | undefined;
  let delay = 50;
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      const result = await apply(current, confirmation);
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
      } else if (error instanceof ConfirmationRequired) {
        if (current !== undefined) {
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.min(delay, Math.max(0, deadline - Date.now())),
            ),
          );
          delay = Math.min(delay * 2, 1000);
        }
        if (Date.now() >= deadline) {
          if (!defer)
            throw new PendingResponseTimeout(
              "Provider confirmation changed; retry this webhook delivery",
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
        }
        if (error.key && error.snapshot)
          confirmation.set(error.key, error.snapshot);
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
