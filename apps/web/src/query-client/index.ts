import * as Sentry from "@sentry/react";
import {
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { handleUnauthorized, isUnauthorizedError } from "@/lib/http-error";
import { isForbiddenOrNotFound } from "@/lib/is-forbidden-or-not-found";
import { OfflineError } from "@/lib/offline/offline-error";
import { toast } from "@/lib/toast";

// TanStack raises these before any fetcher-level message exists; CORS rejections
// from the browser also surface here. Used both to skip auto-retry and to tag
// the captured event so offline-tab reloads don't drown the queue.
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Failed to fetch") ||
    error.message.includes("NetworkError") ||
    error.message.includes("Load failed") ||
    error.message.includes("CORS")
  );
}

// Cancellation surfaces as AbortError from the fetch signal and from TanStack's
// own query cancellation. Treat both as expected control flow, not a failure.
function isCancellationError(error: Error): boolean {
  return (
    error.name === "AbortError" ||
    error.message.toLowerCase().includes("aborted")
  );
}

// In-module cooldown so an offline tab doesn't fire one Sentry event per cache
// entry on every retry tick. Network-class only; API errors are not rate-limited.
const NETWORK_REPORT_COOLDOWN_MS = 60_000;
const networkErrorCooldowns = new Map<string, number>();

function captureCacheError(error: unknown, context: "query" | "mutation") {
  if (!(error instanceof Error)) return;
  if (isCancellationError(error)) return;

  const isNetwork = isNetworkError(error);
  const area = `${isNetwork ? "network" : "api"}.${context}`;

  if (isNetwork) {
    const dedupeKey = `${context}:${error.message}`;
    const lastSent = networkErrorCooldowns.get(dedupeKey);
    const now = Date.now();
    if (lastSent !== undefined && now - lastSent < NETWORK_REPORT_COOLDOWN_MS) {
      return;
    }
    networkErrorCooldowns.set(dedupeKey, now);
    // ponytail: hard cap with full clear; entries older than the cooldown are
    // useless to keep, and `error.message` can vary across fetchers/CORS
    // failures so the keyspace is unbounded in practice.
    if (networkErrorCooldowns.size > 50) networkErrorCooldowns.clear();
  }

  Sentry.captureException(error, { tags: { area } });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        // Keep the 401 in query state so polling guards stay stopped while
        // navigation completes. Better Auth's session is a separate store.
        handleUnauthorized();
        return;
      }
      captureCacheError(error, "query");
    },
  }),
  mutationCache: new MutationCache({
    // Runs before each mutation's own onMutate, so an offline change fails
    // before any optimistic update touches the cache.
    onMutate: () => {
      if (!onlineManager.isOnline()) throw new OfflineError();
    },
    onError: (error) => {
      if (error instanceof OfflineError) {
        toast.error(error.message);
        return;
      }
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }
      captureCacheError(error, "mutation");
    },
  }),
  defaultOptions: {
    queries: {
      // The offline snapshot persists only what the cache still holds, so
      // keep unused data for the day instead of the default five minutes.
      gcTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: (failureCount, error) =>
        isNetworkError(error) ||
        isUnauthorizedError(error) ||
        isForbiddenOrNotFound(error)
          ? false
          : failureCount < 2,
    },
    mutations: {
      retry: false,
    },
  },
});

export default queryClient;
