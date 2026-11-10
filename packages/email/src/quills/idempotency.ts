/**
 * A stable identity for one logical send, carried to the provider so a retry
 * of the same send is delivered once.
 *
 * Retries live above this package: the conversation path retries a failed send
 * in a loop, and the event hook queue re-runs a failed hook job. Both can retry
 * a send the provider in fact accepted (a timeout after acceptance, a 5xx from
 * an edge), and without a key the provider has no way to know the second
 * request is the first one again. The retrying caller is the only party that
 * knows which attempts belong to one send, so it opens the scope and every
 * send inside it carries the same key, whichever sender function it calls.
 *
 * Scoped by async context rather than threaded through each sender's
 * parameters: the hook runs a dozen differently-shaped senders, and the key is
 * a property of the attempt loop around them, not of any one message.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

const scope = new AsyncLocalStorage<string>();

/**
 * Run `fn` with every send inside it carrying a key derived from `key`.
 * Call it OUTSIDE the retry loop: each attempt must see the same key. An
 * undefined key runs `fn` with no key, which is what a caller with no stable
 * identity for its attempts should get.
 */
export function withEmailIdempotencyKey<T>(
  key: string | undefined,
  fn: () => T,
): T {
  if (!key) return fn();
  return scope.run(key, fn);
}

/**
 * The provider-facing key for the current scope, or undefined outside one.
 *
 * Hashed: the raw key can carry a recipient address (a hook job id names its
 * target), which has no business in a request header, and a digest also keeps
 * the value inside the provider's length limit.
 */
export function currentEmailIdempotencyKey(): string | undefined {
  const raw = scope.getStore();
  if (!raw) return undefined;
  return `qb-${createHash("sha256").update(raw).digest("hex")}`;
}
